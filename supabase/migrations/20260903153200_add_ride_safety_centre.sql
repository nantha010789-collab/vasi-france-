create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.ride_safety (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  ride_pin text not null check (ride_pin ~ '^[0-9]{4}$'),
  pin_attempts smallint not null default 0 check (pin_attempts between 0 and 5),
  pin_locked_until timestamptz,
  pin_verified_at timestamptz,
  share_token uuid not null default gen_random_uuid() unique,
  sharing_enabled boolean not null default false,
  share_expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ride_safety enable row level security;

drop policy if exists ride_safety_customer_read on public.ride_safety;
create policy ride_safety_customer_read
on public.ride_safety
for select
to authenticated
using (
  (select auth.uid()) is not null
  and customer_id = (select auth.uid())
);

revoke all on table public.ride_safety from anon;
revoke all on table public.ride_safety from authenticated;
grant select (ride_id, customer_id, ride_pin, pin_verified_at, share_token, sharing_enabled, share_expires_at, created_at, updated_at)
  on table public.ride_safety to authenticated;

create or replace function private.ensure_ride_safety()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.ride_safety (
    ride_id,
    customer_id,
    ride_pin,
    share_expires_at
  ) values (
    new.id,
    new.customer_id,
    lpad((floor(random() * 10000))::integer::text, 4, '0'),
    greatest(now() + interval '7 days', coalesce(new.scheduled_for, now()) + interval '1 day')
  )
  on conflict (ride_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_ride_safety() from public;
revoke all on function private.ensure_ride_safety() from anon;
revoke all on function private.ensure_ride_safety() from authenticated;

drop trigger if exists rides_create_safety on public.rides;
create trigger rides_create_safety
after insert on public.rides
for each row execute function private.ensure_ride_safety();

insert into public.ride_safety (ride_id, customer_id, ride_pin, share_expires_at)
select
  r.id,
  r.customer_id,
  lpad((floor(random() * 10000))::integer::text, 4, '0'),
  greatest(now() + interval '7 days', coalesce(r.scheduled_for, r.requested_at, now()) + interval '1 day')
from public.rides r
on conflict (ride_id) do nothing;

create or replace function public.vasi_driver_start_ride(p_ride_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  did uuid;
  r public.rides;
  s public.ride_safety;
  wait_fee numeric(10,2) := 0;
  supplied_pin text := btrim(coalesce(p_pin, ''));
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select id into did
  from public.drivers
  where user_id = auth.uid()
    and verified = true
    and coalesce(role, 'ride') in ('ride', 'driver', 'ride_driver')
  limit 1;

  if did is null then
    raise exception 'Verified ride driver profile required' using errcode = '42501';
  end if;

  select * into r
  from public.rides
  where id = p_ride_id and driver_id = did
  for update;

  if r.id is null then
    raise exception 'Ride not assigned to this driver' using errcode = '42501';
  end if;
  if r.status::text <> 'driver_arriving' then
    return jsonb_build_object('ok', false, 'error', 'Mark arrival before starting the ride');
  end if;

  select * into s
  from public.ride_safety
  where ride_id = r.id
  for update;

  if s.ride_id is null then
    raise exception 'Ride safety record missing';
  end if;
  if s.pin_locked_until is not null and s.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'Too many incorrect PIN attempts. Try again in a few minutes.'
    );
  end if;
  if supplied_pin !~ '^[0-9]{4}$' or supplied_pin <> s.ride_pin then
    update public.ride_safety
    set
      pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
      pin_locked_until = case when pin_attempts >= 4 then now() + interval '5 minutes' else null end,
      updated_at = now()
    where ride_id = r.id;
    return jsonb_build_object('ok', false, 'error', 'Incorrect ride PIN');
  end if;

  if r.arrived_at is not null then
    wait_fee := greatest(
      0,
      ceil(greatest(0, extract(epoch from (now() - r.arrived_at)) - 180) / 60.0) * 0.30
    );
  end if;

  update public.ride_safety
  set pin_attempts = 0, pin_locked_until = null, pin_verified_at = now(), updated_at = now()
  where ride_id = r.id;

  update public.rides
  set status = 'in_progress', started_at = now(), waiting_fee = wait_fee
  where id = r.id
  returning * into r;

  return jsonb_build_object('ok', true, 'ride', to_jsonb(r));
end;
$$;

revoke all on function public.vasi_driver_start_ride(uuid, text) from public;
revoke all on function public.vasi_driver_start_ride(uuid, text) from anon;
revoke all on function public.vasi_driver_start_ride(uuid, text) from authenticated;
grant execute on function public.vasi_driver_start_ride(uuid, text) to authenticated;

create or replace function public.vasi_driver_trip_action(p_ride_id uuid, p_action text)
returns public.rides
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  did uuid;
  r public.rides;
  pending_stops integer := 0;
begin
  select id into did from public.drivers
  where user_id = auth.uid()
    and verified = true
    and coalesce(role, 'ride') in ('ride', 'driver', 'ride_driver')
  limit 1;
  if did is null then raise exception 'Verified ride driver profile required'; end if;

  select * into r from public.rides where id = p_ride_id and driver_id = did for update;
  if r.id is null then raise exception 'Ride not assigned to this driver'; end if;

  if p_action = 'arrive' then
    if r.status::text <> 'accepted' then raise exception 'Driver cannot mark arrival for this ride'; end if;
    update public.rides
    set status = 'driver_arriving', arrived_at = coalesce(arrived_at, now())
    where id = r.id returning * into r;
  elsif p_action = 'start' then
    raise exception 'Customer ride PIN is required to start the ride';
  elsif p_action = 'complete' then
    if r.status::text <> 'in_progress' then raise exception 'Ride cannot be completed'; end if;
    select count(*) into pending_stops
    from public.ride_stops where ride_id = r.id and completed_at is null;
    if pending_stops > 0 then raise exception 'Complete all intermediate stops first'; end if;
    update public.rides
    set
      status = 'completed',
      completed_at = now(),
      final_fare = round((coalesce(estimated_fare, 0) + coalesce(waiting_fee, 0))::numeric, 2)
    where id = r.id returning * into r;
    update public.drivers set online = false, updated_at = now() where id = did;
  else
    raise exception 'Unsupported trip action';
  end if;
  return r;
end;
$$;

create or replace function public.get_customer_ride_status(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.rides;
  d public.drivers;
  l public.driver_locations;
  s public.ride_safety;
  loc_lat double precision;
  loc_lng double precision;
  loc_updated timestamptz;
begin
  select * into r
  from public.rides
  where id = p_ride_id and customer_id = auth.uid();
  if not found then raise exception 'Ride not found'; end if;

  select * into s
  from public.ride_safety
  where ride_id = r.id and customer_id = auth.uid();

  if r.driver_id is not null then
    select * into d from public.drivers where id = r.driver_id;
    select * into l
    from public.driver_locations
    where driver_id = r.driver_id
    order by updated_at desc
    limit 1;
    loc_lat := coalesce(l.latitude, d.latitude);
    loc_lng := coalesce(l.longitude, d.longitude);
    loc_updated := coalesce(l.updated_at, d.updated_at);
  end if;

  return jsonb_build_object(
    'ride', to_jsonb(r),
    'driver', case when d.id is null then null else jsonb_build_object(
      'id', d.id,
      'full_name', d.full_name,
      'vehicle_make', d.vehicle_make,
      'vehicle_model', d.vehicle_model,
      'vehicle_plate', d.vehicle_plate,
      'vehicle_color', d.vehicle_color,
      'rating', d.rating
    ) end,
    'location', case when loc_lat is null or loc_lng is null then null else jsonb_build_object(
      'latitude', loc_lat,
      'longitude', loc_lng,
      'updated_at', loc_updated
    ) end,
    'safety', case when s.ride_id is null then null else jsonb_build_object(
      'ride_pin', s.ride_pin,
      'pin_verified_at', s.pin_verified_at,
      'share_token', s.share_token,
      'sharing_enabled', s.sharing_enabled,
      'share_expires_at', s.share_expires_at
    ) end
  );
end;
$$;

comment on table public.ride_safety is
  'Private per-ride PIN and unguessable customer-controlled trip share token.';
