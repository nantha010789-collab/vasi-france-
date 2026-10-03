-- VASI Driver marketplace: expose only the offer and planned-ride fields that
-- an authenticated, verified ride driver needs. These functions intentionally
-- avoid passenger names, phone numbers and private notes before pickup.

create index if not exists rides_planned_marketplace_idx
  on public.rides (scheduled_for)
  where scheduled_for is not null and driver_id is null;

create or replace function public.vasi_driver_offer_details()
returns table(
  offer_id uuid,
  ride_id uuid,
  expires_at timestamptz,
  scheduled_for timestamptz,
  service text,
  driver_amount numeric,
  estimated_fare numeric,
  currency text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  payment_method text,
  service_options text[],
  airport_pickup boolean,
  passenger_count smallint,
  luggage_count smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  driver_uuid uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select d.id
    into driver_uuid
    from public.drivers d
   where d.user_id = caller
     and d.verified = true
     and d.role = 'ride'
   limit 1;

  if driver_uuid is null then
    raise exception 'Verified ride driver profile required';
  end if;

  return query
  select
    o.id,
    r.id,
    o.expires_at,
    r.scheduled_for,
    r.service,
    r.driver_amount,
    r.estimated_fare,
    r.currency,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.destination_address,
    r.destination_lat,
    r.destination_lng,
    r.payment_method,
    coalesce(r.service_options, '{}'::text[]),
    coalesce(r.airport_pickup, false),
    coalesce(r.passenger_count, 1)::smallint,
    coalesce(r.luggage_count, 0)::smallint
  from public.vasi_dispatch_offers o
  join public.rides r on r.id = o.job_id
  where o.driver_id = driver_uuid
    and o.service = 'ride'
    and o.status = 'pending'
    and o.expires_at > now()
    and r.status = 'requested'
    and r.driver_id is null
  order by o.offered_at desc
  limit 1;
end;
$$;

revoke all on function public.vasi_driver_offer_details() from public, anon;
grant execute on function public.vasi_driver_offer_details() to authenticated;

create or replace function public.vasi_driver_planned_rides()
returns table(
  ride_id uuid,
  reservation_state text,
  scheduled_for timestamptz,
  service text,
  driver_amount numeric,
  estimated_fare numeric,
  currency text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  payment_method text,
  service_options text[],
  airport_pickup boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  caller uuid := (select auth.uid());
  driver_uuid uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select d.id
    into driver_uuid
    from public.drivers d
   where d.user_id = caller
     and d.verified = true
     and d.role = 'ride'
   limit 1;

  if driver_uuid is null then
    raise exception 'Verified ride driver profile required';
  end if;

  return query
  select
    r.id,
    case when r.driver_id = driver_uuid then 'confirmed'::text else 'available'::text end,
    r.scheduled_for,
    r.service,
    r.driver_amount,
    r.estimated_fare,
    r.currency,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.destination_address,
    r.destination_lat,
    r.destination_lng,
    r.payment_method,
    coalesce(r.service_options, '{}'::text[]),
    coalesce(r.airport_pickup, false)
  from public.rides r
  where r.scheduled_for > now() + interval '30 minutes'
    and r.scheduled_for <= now() + interval '90 days'
    and (
      (r.status = 'requested' and r.driver_id is null)
      or
      (r.status = 'accepted' and r.driver_id = driver_uuid)
    )
  order by (r.driver_id = driver_uuid) desc, r.scheduled_for asc
  limit 60;
end;
$$;

revoke all on function public.vasi_driver_planned_rides() from public, anon;
grant execute on function public.vasi_driver_planned_rides() to authenticated;

create or replace function public.vasi_driver_claim_planned_ride(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  driver_uuid uuid;
  target public.rides;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select d.id
    into driver_uuid
    from public.drivers d
   where d.user_id = caller
     and d.verified = true
     and d.role = 'ride'
   limit 1;

  if driver_uuid is null then
    raise exception 'Verified ride driver profile required';
  end if;

  select r.*
    into target
    from public.rides r
   where r.id = p_ride_id
     and r.status = 'requested'
     and r.driver_id is null
     and r.scheduled_for > now() + interval '30 minutes'
     and r.scheduled_for <= now() + interval '90 days'
   for update;

  if target.id is null then
    raise exception 'Planned ride is no longer available';
  end if;

  if exists (
    select 1
      from public.rides existing
     where existing.driver_id = driver_uuid
       and existing.status in ('accepted', 'driver_arriving', 'in_progress')
       and existing.scheduled_for is not null
       and abs(extract(epoch from (existing.scheduled_for - target.scheduled_for))) < 5400
  ) then
    raise exception 'Another planned ride overlaps this pickup time';
  end if;

  update public.rides
     set driver_id = driver_uuid,
         status = 'accepted',
         accepted_at = now()
   where id = target.id
   returning * into target;

  update public.vasi_dispatch_offers
     set status = 'cancelled',
         responded_at = coalesce(responded_at, now())
   where job_id = target.id
     and service = 'ride'
     and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'ride_id', target.id,
    'scheduled_for', target.scheduled_for,
    'status', target.status
  );
end;
$$;

revoke all on function public.vasi_driver_claim_planned_ride(uuid) from public, anon;
grant execute on function public.vasi_driver_claim_planned_ride(uuid) to authenticated;

create or replace function public.vasi_driver_release_planned_ride(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  driver_uuid uuid;
  target public.rides;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select d.id
    into driver_uuid
    from public.drivers d
   where d.user_id = caller
     and d.verified = true
     and d.role = 'ride'
   limit 1;

  if driver_uuid is null then
    raise exception 'Verified ride driver profile required';
  end if;

  select r.*
    into target
    from public.rides r
   where r.id = p_ride_id
     and r.driver_id = driver_uuid
     and r.status = 'accepted'
     and r.scheduled_for > now() + interval '60 minutes'
   for update;

  if target.id is null then
    raise exception 'This planned ride can no longer be released in the app';
  end if;

  update public.rides
     set driver_id = null,
         status = 'requested',
         accepted_at = null
   where id = target.id;

  return jsonb_build_object('ok', true, 'ride_id', target.id, 'status', 'requested');
end;
$$;

revoke all on function public.vasi_driver_release_planned_ride(uuid) from public, anon;
grant execute on function public.vasi_driver_release_planned_ride(uuid) to authenticated;
