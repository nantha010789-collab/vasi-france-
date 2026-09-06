-- Require every paid VASI provider to finish Stripe/RIB verification before
-- becoming available, and track restaurant transfers per Eats order.

alter table public.drivers
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

alter table public.restaurants
  add column if not exists stripe_account_id text,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

create unique index if not exists restaurants_stripe_account_unique
  on public.restaurants (stripe_account_id)
  where stripe_account_id is not null;

alter table public.eats_orders
  add column if not exists restaurant_payout_status text not null default 'not_ready',
  add column if not exists restaurant_transfer_id text,
  add column if not exists restaurant_paid_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eats_orders_restaurant_payout_status_check'
  ) then
    alter table public.eats_orders
      add constraint eats_orders_restaurant_payout_status_check
      check (restaurant_payout_status in (
        'not_ready', 'pending', 'requires_onboarding', 'paid', 'failed'
      ));
  end if;
end
$$;

create unique index if not exists eats_orders_restaurant_transfer_unique
  on public.eats_orders (restaurant_transfer_id)
  where restaurant_transfer_id is not null;

-- Existing approved providers must connect a verified bank account before
-- accepting new work or orders.
update public.drivers
set online = false, updated_at = now()
where online = true
  and (stripe_account_id is null or stripe_payouts_enabled = false);

update public.restaurants
set is_open = false, updated_at = now()
where is_open = true
  and (stripe_account_id is null or stripe_payouts_enabled = false);

create or replace function public.vasi_driver_set_online(
  p_online boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.drivers
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  d public.drivers;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  if p_online and not exists (
    select 1
    from public.drivers
    where user_id = auth.uid()
      and verified = true
      and coalesce(role, 'ride') in ('ride', 'driver', 'ride_driver')
      and stripe_account_id is not null
      and stripe_payouts_enabled = true
  ) then
    raise exception 'Connect and verify your bank account (RIB) before going online'
      using errcode = '42501';
  end if;

  update public.drivers
  set online = p_online,
      latitude = coalesce(p_lat, latitude),
      longitude = coalesce(p_lng, longitude),
      updated_at = now()
  where user_id = auth.uid()
    and verified = true
    and coalesce(role, 'ride') in ('ride', 'driver', 'ride_driver')
  returning * into d;

  if d.id is null then
    raise exception 'Verified ride driver profile required' using errcode = '42501';
  end if;

  if p_lat is not null and p_lng is not null then
    insert into public.driver_locations(driver_id, latitude, longitude, updated_at)
    values (d.id, p_lat, p_lng, now())
    on conflict (driver_id) do update
      set latitude = excluded.latitude,
          longitude = excluded.longitude,
          updated_at = excluded.updated_at;
  end if;

  return d;
end;
$$;

revoke all on function public.vasi_driver_set_online(boolean, double precision, double precision)
  from public, anon;
grant execute on function public.vasi_driver_set_online(boolean, double precision, double precision)
  to authenticated;

create or replace function public.vasi_restaurant_toggle_open(p_is_open boolean)
returns public.restaurants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.restaurants;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  if p_is_open and not exists (
    select 1
    from public.restaurants
    where owner_id = auth.uid()
      and status = 'approved'
      and active = true
      and stripe_account_id is not null
      and stripe_payouts_enabled = true
  ) then
    raise exception 'Connect and verify your bank account (RIB) before opening your restaurant'
      using errcode = '42501';
  end if;

  update public.restaurants
  set is_open = p_is_open, updated_at = now()
  where owner_id = auth.uid()
    and status = 'approved'
    and active = true
  returning * into r;

  if r.id is null then
    raise exception 'VASI approval is required before going online'
      using errcode = '42501';
  end if;
  return r;
end;
$$;

revoke all on function public.vasi_restaurant_toggle_open(boolean) from public, anon;
grant execute on function public.vasi_restaurant_toggle_open(boolean) to authenticated;

create or replace function public.vasi_restaurant_complete_own_delivery(
  p_order_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  restaurant public.restaurants;
  order_row public.eats_orders;
  safety public.eats_order_safety;
  supplied_pin text := btrim(coalesce(p_pin, ''));
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select * into restaurant
  from public.restaurants
  where owner_id = auth.uid() and status = 'approved' and active = true
  limit 1;

  if restaurant.id is null then
    raise exception 'Approved restaurant account required' using errcode = '42501';
  end if;

  select * into order_row
  from public.eats_orders
  where id = p_order_id and restaurant_id = restaurant.id
  for update;

  if order_row.id is null then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if order_row.delivery_mode <> 'own' then
    return jsonb_build_object('ok', false, 'error', 'This order uses a VASI courier');
  end if;
  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'error', 'Customer payment is not confirmed');
  end if;
  if order_row.status <> 'ready_for_pickup' then
    return jsonb_build_object('ok', false, 'error', 'Complete the current order step first');
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
    set pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
        pin_locked_until = case
          when pin_attempts >= 4 then now() + interval '5 minutes'
          else null
        end,
        updated_at = now()
    where order_id = order_row.id;
    return jsonb_build_object('ok', false, 'error', 'Incorrect delivery PIN');
  end if;

  update public.eats_order_safety
  set pin_attempts = 0,
      pin_locked_until = null,
      pin_verified_at = now(),
      updated_at = now()
  where order_id = order_row.id;

  perform set_config('vasi.eats_pin_verified', 'on', true);
  update public.eats_orders
  set status = 'delivered',
      delivered_at = now(),
      restaurant_payout_status = case
        when restaurant.stripe_account_id is null
          or restaurant.stripe_payouts_enabled = false
          then 'requires_onboarding'
        else 'pending'
      end
  where id = order_row.id
  returning * into order_row;

  return jsonb_build_object('ok', true, 'eat', to_jsonb(order_row));
end;
$$;

revoke all on function public.vasi_restaurant_complete_own_delivery(uuid, text)
  from public, anon;
grant execute on function public.vasi_restaurant_complete_own_delivery(uuid, text)
  to authenticated;

comment on column public.restaurants.stripe_account_id is
  'Stripe connected account identifier. Full bank details remain with Stripe.';
comment on column public.eats_orders.restaurant_payout_status is
  'Server-managed restaurant transfer status for this paid Eats order.';
