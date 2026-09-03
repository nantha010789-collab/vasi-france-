create or replace function public.vasi_set_trip_sharing(p_ride_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.rides;
  s public.ride_safety;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select * into r
  from public.rides
  where id = p_ride_id and customer_id = auth.uid();
  if r.id is null then
    raise exception 'Ride not found' using errcode = '42501';
  end if;
  if coalesce(p_enabled, false) and r.status::text not in ('accepted', 'driver_arriving', 'in_progress') then
    raise exception 'Trip sharing is available only for an active ride';
  end if;

  update public.ride_safety
  set
    sharing_enabled = coalesce(p_enabled, false),
    share_expires_at = case
      when coalesce(p_enabled, false) then greatest(share_expires_at, now() + interval '1 day')
      else share_expires_at
    end,
    updated_at = now()
  where ride_id = r.id and customer_id = auth.uid()
  returning * into s;

  if s.ride_id is null then
    raise exception 'Ride safety record missing';
  end if;

  return jsonb_build_object(
    'enabled', s.sharing_enabled,
    'share_token', s.share_token,
    'expires_at', s.share_expires_at
  );
end;
$$;

revoke all on function public.vasi_set_trip_sharing(uuid, boolean) from public;
revoke all on function public.vasi_set_trip_sharing(uuid, boolean) from anon;
revoke all on function public.vasi_set_trip_sharing(uuid, boolean) from authenticated;
grant execute on function public.vasi_set_trip_sharing(uuid, boolean) to authenticated;

create or replace function public.get_shared_ride(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  s public.ride_safety;
  r public.rides;
  d public.drivers;
  l public.driver_locations;
begin
  select * into s
  from public.ride_safety
  where share_token = p_token
    and sharing_enabled = true
    and share_expires_at > now();
  if s.ride_id is null then return null; end if;

  select * into r from public.rides where id = s.ride_id;
  if r.id is null then return null; end if;

  if r.driver_id is not null then
    select * into d from public.drivers where id = r.driver_id;
    if r.status::text in ('accepted', 'driver_arriving', 'in_progress') then
      select * into l
      from public.driver_locations
      where driver_id = r.driver_id
      order by updated_at desc
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'ride', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'service', r.service,
      'pickup_address', r.pickup_address,
      'pickup_lat', r.pickup_lat,
      'pickup_lng', r.pickup_lng,
      'destination_address', r.destination_address,
      'destination_lat', r.destination_lat,
      'destination_lng', r.destination_lng,
      'requested_at', r.requested_at,
      'accepted_at', r.accepted_at,
      'arrived_at', r.arrived_at,
      'started_at', r.started_at,
      'completed_at', r.completed_at,
      'cancelled_at', r.cancelled_at
    ),
    'driver', case when d.id is null then null else jsonb_build_object(
      'full_name', d.full_name,
      'vehicle_make', d.vehicle_make,
      'vehicle_model', d.vehicle_model,
      'vehicle_plate', d.vehicle_plate,
      'vehicle_color', d.vehicle_color,
      'rating', d.rating
    ) end,
    'location', case when l.driver_id is null then null else jsonb_build_object(
      'latitude', l.latitude,
      'longitude', l.longitude,
      'updated_at', l.updated_at
    ) end,
    'refreshed_at', now()
  );
end;
$$;

revoke all on function public.get_shared_ride(uuid) from public;
revoke all on function public.get_shared_ride(uuid) from anon;
revoke all on function public.get_shared_ride(uuid) from authenticated;
grant execute on function public.get_shared_ride(uuid) to anon;
grant execute on function public.get_shared_ride(uuid) to authenticated;

comment on function public.get_shared_ride(uuid) is
  'Intentional public bearer-token endpoint returning sanitized trip data only.';
