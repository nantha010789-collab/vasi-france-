-- Ride PINs are required only until a customer completes their first ride.
alter table public.ride_safety
  add column if not exists pin_required boolean not null default true;

create or replace function private.customer_requires_ride_pin(
  p_customer_id uuid,
  p_ride_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.rides previous
    where previous.customer_id = p_customer_id
      and coalesce(previous.mode, 'ride') = 'ride'
      and previous.status::text = 'completed'
      and (p_ride_id is null or previous.id <> p_ride_id)
  );
$$;

revoke all on function private.customer_requires_ride_pin(uuid, uuid) from public;
revoke all on function private.customer_requires_ride_pin(uuid, uuid) from anon;
revoke all on function private.customer_requires_ride_pin(uuid, uuid) from authenticated;

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
    pin_required,
    share_expires_at
  ) values (
    new.id,
    new.customer_id,
    lpad((floor(random() * 10000))::integer::text, 4, '0'),
    case
      when coalesce(new.mode, 'ride') = 'ride'
        then private.customer_requires_ride_pin(new.customer_id, new.id)
      else false
    end,
    greatest(now() + interval '7 days', coalesce(new.scheduled_for, now()) + interval '1 day')
  )
  on conflict (ride_id) do nothing;
  return new;
end;
$$;

update public.ride_safety safety
set pin_required = case
  when coalesce(ride.mode, 'ride') <> 'ride' then false
  else not exists (
    select 1
    from public.rides previous
    where previous.customer_id = safety.customer_id
      and coalesce(previous.mode, 'ride') = 'ride'
      and previous.status::text = 'completed'
      and previous.id <> safety.ride_id
      and coalesce(previous.completed_at, previous.requested_at)
          <= coalesce(ride.completed_at, ride.requested_at)
  )
end,
updated_at = now()
from public.rides ride
where ride.id = safety.ride_id;

create or replace function public.get_driver_ride_pin_requirement(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  did uuid;
  ride public.rides;
  requires_pin boolean;
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

  select * into ride
  from public.rides
  where id = p_ride_id and driver_id = did;

  if ride.id is null then
    raise exception 'Ride not assigned to this driver' using errcode = '42501';
  end if;

  requires_pin := coalesce(ride.mode, 'ride') = 'ride'
    and private.customer_requires_ride_pin(ride.customer_id, ride.id);

  update public.ride_safety
  set pin_required = requires_pin, updated_at = now()
  where ride_id = ride.id;

  return jsonb_build_object('pin_required', requires_pin);
end;
$$;

revoke all on function public.get_driver_ride_pin_requirement(uuid) from public;
revoke all on function public.get_driver_ride_pin_requirement(uuid) from anon;
revoke all on function public.get_driver_ride_pin_requirement(uuid) from authenticated;
grant execute on function public.get_driver_ride_pin_requirement(uuid) to authenticated;

create or replace function public.vasi_driver_start_ride(p_ride_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  did uuid;
  ride public.rides;
  safety public.ride_safety;
  wait_fee numeric(10,2) := 0;
  supplied_pin text := btrim(coalesce(p_pin, ''));
  requires_pin boolean;
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

  select * into ride
  from public.rides
  where id = p_ride_id and driver_id = did
  for update;

  if ride.id is null then
    raise exception 'Ride not assigned to this driver' using errcode = '42501';
  end if;
  if ride.status::text <> 'driver_arriving' then
    return jsonb_build_object('ok', false, 'error', 'Mark arrival before starting the ride');
  end if;

  select * into safety
  from public.ride_safety
  where ride_id = ride.id
  for update;

  if safety.ride_id is null then
    raise exception 'Ride safety record missing';
  end if;

  requires_pin := coalesce(ride.mode, 'ride') = 'ride'
    and private.customer_requires_ride_pin(ride.customer_id, ride.id);

  update public.ride_safety
  set pin_required = requires_pin, updated_at = now()
  where ride_id = ride.id;

  if requires_pin then
    if safety.pin_locked_until is not null and safety.pin_locked_until > now() then
      return jsonb_build_object(
        'ok', false,
        'error', 'Too many incorrect PIN attempts. Try again in a few minutes.'
      );
    end if;

    if supplied_pin !~ '^[0-9]{4}$' or supplied_pin <> safety.ride_pin then
      update public.ride_safety
      set
        pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
        pin_locked_until = case when pin_attempts >= 4 then now() + interval '5 minutes' else null end,
        updated_at = now()
      where ride_id = ride.id;
      return jsonb_build_object('ok', false, 'error', 'Incorrect ride PIN');
    end if;

    update public.ride_safety
    set pin_attempts = 0, pin_locked_until = null, pin_verified_at = now(), updated_at = now()
    where ride_id = ride.id;
  else
    update public.ride_safety
    set pin_attempts = 0, pin_locked_until = null, pin_verified_at = null, updated_at = now()
    where ride_id = ride.id;
  end if;

  if ride.arrived_at is not null then
    wait_fee := greatest(
      0,
      ceil(greatest(0, extract(epoch from (now() - ride.arrived_at)) - 180) / 60.0) * 0.30
    );
  end if;

  update public.rides
  set status = 'in_progress', started_at = now(), waiting_fee = wait_fee
  where id = ride.id
  returning * into ride;

  return jsonb_build_object('ok', true, 'pin_required', requires_pin, 'ride', to_jsonb(ride));
end;
$$;

revoke all on function public.vasi_driver_start_ride(uuid, text) from public;
revoke all on function public.vasi_driver_start_ride(uuid, text) from anon;
revoke all on function public.vasi_driver_start_ride(uuid, text) from authenticated;
grant execute on function public.vasi_driver_start_ride(uuid, text) to authenticated;

create or replace function public.get_customer_ride_status(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ride public.rides;
  driver public.drivers;
  location public.driver_locations;
  safety public.ride_safety;
  loc_lat double precision;
  loc_lng double precision;
  loc_updated timestamptz;
  requires_pin boolean;
begin
  select * into ride
  from public.rides
  where id = p_ride_id and customer_id = auth.uid();
  if not found then raise exception 'Ride not found'; end if;

  select * into safety
  from public.ride_safety
  where ride_id = ride.id and customer_id = auth.uid();

  requires_pin := coalesce(ride.mode, 'ride') = 'ride'
    and private.customer_requires_ride_pin(ride.customer_id, ride.id);

  if safety.ride_id is not null and safety.pin_required is distinct from requires_pin then
    update public.ride_safety
    set pin_required = requires_pin, updated_at = now()
    where ride_id = ride.id;
    safety.pin_required := requires_pin;
  end if;

  if ride.driver_id is not null then
    select * into driver from public.drivers where id = ride.driver_id;
    select * into location
    from public.driver_locations
    where driver_id = ride.driver_id
    order by updated_at desc
    limit 1;
    loc_lat := coalesce(location.latitude, driver.latitude);
    loc_lng := coalesce(location.longitude, driver.longitude);
    loc_updated := coalesce(location.updated_at, driver.updated_at);
  end if;

  return jsonb_build_object(
    'ride', to_jsonb(ride),
    'driver', case when driver.id is null then null else jsonb_build_object(
      'id', driver.id,
      'full_name', driver.full_name,
      'vehicle_make', driver.vehicle_make,
      'vehicle_model', driver.vehicle_model,
      'vehicle_plate', driver.vehicle_plate,
      'vehicle_color', driver.vehicle_color,
      'rating', driver.rating
    ) end,
    'location', case when loc_lat is null or loc_lng is null then null else jsonb_build_object(
      'latitude', loc_lat,
      'longitude', loc_lng,
      'updated_at', loc_updated
    ) end,
    'safety', case when safety.ride_id is null then null else jsonb_build_object(
      'pin_required', requires_pin,
      'ride_pin', case when requires_pin then safety.ride_pin else null end,
      'pin_verified_at', safety.pin_verified_at,
      'share_token', safety.share_token,
      'sharing_enabled', safety.sharing_enabled,
      'share_expires_at', safety.share_expires_at
    ) end
  );
end;
$$;

grant select (pin_required) on table public.ride_safety to authenticated;

-- Every VASI Eats order gets a separate delivery PIN.
create table if not exists public.eats_order_safety (
  order_id uuid primary key references public.eats_orders(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete cascade,
  delivery_pin text not null check (delivery_pin ~ '^[0-9]{4}$'),
  pin_attempts smallint not null default 0 check (pin_attempts between 0 and 5),
  pin_locked_until timestamptz,
  pin_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eats_order_safety enable row level security;

drop policy if exists eats_order_safety_customer_read on public.eats_order_safety;
create policy eats_order_safety_customer_read
on public.eats_order_safety
for select
to authenticated
using (
  (select auth.uid()) is not null
  and customer_id = (select auth.uid())
);

revoke all on table public.eats_order_safety from anon;
revoke all on table public.eats_order_safety from authenticated;
grant select (order_id, customer_id, delivery_pin, pin_verified_at, created_at, updated_at)
  on table public.eats_order_safety to authenticated;

create or replace function private.ensure_eats_order_safety()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.eats_order_safety (order_id, customer_id, delivery_pin)
  values (
    new.id,
    new.customer_id,
    lpad((floor(random() * 10000))::integer::text, 4, '0')
  )
  on conflict (order_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_eats_order_safety() from public;
revoke all on function private.ensure_eats_order_safety() from anon;
revoke all on function private.ensure_eats_order_safety() from authenticated;

drop trigger if exists eats_orders_create_safety on public.eats_orders;
create trigger eats_orders_create_safety
after insert on public.eats_orders
for each row execute function private.ensure_eats_order_safety();

insert into public.eats_order_safety (order_id, customer_id, delivery_pin)
select
  order_row.id,
  order_row.customer_id,
  lpad((floor(random() * 10000))::integer::text, 4, '0')
from public.eats_orders order_row
on conflict (order_id) do nothing;

create or replace function private.enforce_eats_delivery_pin()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.status = 'delivered'
    and old.status is distinct from 'delivered'
    and coalesce(current_setting('vasi.eats_pin_verified', true), '') <> 'on'
  then
    raise exception 'Customer Eats delivery PIN is required';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_eats_delivery_pin() from public;
revoke all on function private.enforce_eats_delivery_pin() from anon;
revoke all on function private.enforce_eats_delivery_pin() from authenticated;

drop trigger if exists eats_orders_require_delivery_pin on public.eats_orders;
create trigger eats_orders_require_delivery_pin
before update of status on public.eats_orders
for each row execute function private.enforce_eats_delivery_pin();

create or replace function public.vasi_courier_complete_eats_order(
  p_order_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  courier public.delivery_drivers;
  order_row public.eats_orders;
  safety public.eats_order_safety;
  supplied_pin text := btrim(coalesce(p_pin, ''));
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select * into courier
  from public.delivery_drivers
  where user_id = auth.uid() and verified = true
  limit 1;

  if courier.id is null then
    raise exception 'Verified courier profile required' using errcode = '42501';
  end if;

  select * into order_row
  from public.eats_orders
  where id = p_order_id and delivery_driver_id = courier.id
  for update;

  if order_row.id is null then
    raise exception 'Eats order not assigned to this courier' using errcode = '42501';
  end if;
  if order_row.status <> 'picked_up' then
    return jsonb_build_object('ok', false, 'error', 'Pick up the order before delivery');
  end if;

  select * into safety
  from public.eats_order_safety
  where order_id = order_row.id
  for update;

  if safety.order_id is null then
    raise exception 'Eats delivery safety record missing';
  end if;
  if safety.pin_locked_until is not null and safety.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'Too many incorrect PIN attempts. Try again in a few minutes.'
    );
  end if;

  if supplied_pin !~ '^[0-9]{4}$' or supplied_pin <> safety.delivery_pin then
    update public.eats_order_safety
    set
      pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
      pin_locked_until = case when pin_attempts >= 4 then now() + interval '5 minutes' else null end,
      updated_at = now()
    where order_id = order_row.id;
    return jsonb_build_object('ok', false, 'error', 'Incorrect delivery PIN');
  end if;

  update public.eats_order_safety
  set pin_attempts = 0, pin_locked_until = null, pin_verified_at = now(), updated_at = now()
  where order_id = order_row.id;

  perform set_config('vasi.eats_pin_verified', 'on', true);
  update public.eats_orders
  set status = 'delivered', delivered_at = now()
  where id = order_row.id
  returning * into order_row;

  update public.delivery_drivers
  set online = false, updated_at = now()
  where id = courier.id;

  return jsonb_build_object('ok', true, 'eat', to_jsonb(order_row));
end;
$$;

revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from public;
revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from anon;
revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from authenticated;
grant execute on function public.vasi_courier_complete_eats_order(uuid, text) to authenticated;

comment on column public.ride_safety.pin_required is
  'True only while the customer has not completed a previous passenger ride.';
comment on table public.eats_order_safety is
  'Private per-order handover PIN. Every VASI Eats order receives a fresh PIN.';
