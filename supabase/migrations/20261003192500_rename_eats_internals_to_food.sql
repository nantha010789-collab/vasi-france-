-- Rename the internal VASI Eats domain to VASI Food without losing data.
-- Legacy views and RPC wrappers remain temporarily so an older cached app
-- can finish an in-flight request while production moves to food_* names.

alter table public.eats_group_orders rename to food_group_orders;
alter table public.eats_group_order_members rename to food_group_order_members;
alter table public.eats_orders rename to food_orders;
alter table public.eats_order_safety rename to food_order_safety;
alter table public.courier_eats_earnings rename to courier_food_earnings;

alter function private.ensure_eats_order_safety() rename to ensure_food_order_safety;
alter function private.enforce_eats_delivery_pin() rename to enforce_food_delivery_pin;
alter function public.release_scheduled_eats_orders() rename to release_scheduled_food_orders;
alter function public.vasi_courier_complete_eats_order(uuid, text) rename to vasi_courier_complete_food_order;
alter function public.vasi_set_eats_order_commission() rename to vasi_set_food_order_commission;

-- Rename table-owned objects so the database catalog also uses food_*.
do $rename_constraints$
declare
  item record;
begin
  for item in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where conrelid in (
      'public.food_group_orders'::regclass,
      'public.food_group_order_members'::regclass,
      'public.food_orders'::regclass,
      'public.food_order_safety'::regclass,
      'public.courier_food_earnings'::regclass
    )
      and conname like '%eats%'
  loop
    execute format(
      'alter table %s rename constraint %I to %I',
      item.table_name,
      item.conname,
      replace(item.conname, 'eats', 'food')
    );
  end loop;
end
$rename_constraints$;

do $rename_indexes$
declare
  item record;
begin
  for item in
    select schemaname, indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename in (
        'food_group_orders',
        'food_group_order_members',
        'food_orders',
        'food_order_safety',
        'courier_food_earnings'
      )
      and indexname like '%eats%'
  loop
    execute format(
      'alter index %I.%I rename to %I',
      item.schemaname,
      item.indexname,
      replace(item.indexname, 'eats', 'food')
    );
  end loop;
end
$rename_indexes$;

do $rename_policies$
declare
  item record;
begin
  for item in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'food_group_orders',
        'food_group_order_members',
        'food_orders',
        'food_order_safety',
        'courier_food_earnings'
      )
      and policyname ilike '%eats%'
  loop
    execute format(
      'alter policy %I on public.%I rename to %I',
      item.policyname,
      item.tablename,
      replace(item.policyname, 'eats', 'food')
    );
  end loop;
end
$rename_policies$;

do $rename_triggers$
declare
  item record;
begin
  for item in
    select c.relname as table_name, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and c.relname = 'food_orders'
      and t.tgname ilike '%eats%'
  loop
    execute format(
      'alter trigger %I on public.%I rename to %I',
      item.tgname,
      item.table_name,
      replace(item.tgname, 'eats', 'food')
    );
  end loop;
end
$rename_triggers$;

create or replace function private.ensure_food_order_safety()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.food_order_safety (order_id, customer_id, delivery_pin)
  values (
    new.id,
    new.customer_id,
    lpad((floor(random() * 10000))::integer::text, 4, '0')
  )
  on conflict (order_id) do nothing;
  return new;
end;
$$;

create or replace function private.enforce_food_delivery_pin()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.status = 'delivered'
    and old.status is distinct from 'delivered'
    and coalesce(current_setting('vasi.food_pin_verified', true), '') <> 'on'
  then
    raise exception 'Customer VASI Food delivery PIN is required';
  end if;
  return new;
end;
$$;

create or replace function private.is_group_host(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.food_group_orders group_order
    where group_order.id = p_group_id
      and group_order.host_user_id = auth.uid()
  )
$$;

create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.food_group_order_members member
    where member.group_order_id = p_group_id
      and member.user_id = auth.uid()
  )
$$;

create or replace function public.vasi_set_food_order_commission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.commission_rate := 0.10;
  new.restaurant_commission := round(new.subtotal * 0.10, 2);
  new.restaurant_net := round(new.subtotal - new.restaurant_commission, 2);
  return new;
end;
$$;

create or replace function public.release_scheduled_food_orders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  released_count integer;
begin
  update public.food_orders
  set status = 'pending'
  where status = 'scheduled'
    and payment_status = 'paid'
    and scheduled_for <= now() + interval '20 minutes';
  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

create or replace function public.vasi_courier_complete_food_order(
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
  order_row public.food_orders;
  safety public.food_order_safety;
  supplied_pin text := btrim(coalesce(p_pin, ''));
  protected_amount numeric(10,2);
  quoted_amount numeric(10,2);
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
  from public.food_orders
  where id = p_order_id and delivery_driver_id = courier.id
  for update;

  if order_row.id is null then
    raise exception 'VASI Food order not assigned to this courier' using errcode = '42501';
  end if;
  if order_row.status <> 'picked_up' then
    return jsonb_build_object('ok', false, 'error', 'Pick up the order before delivery');
  end if;
  if order_row.delivery_mode <> 'vasi' then
    return jsonb_build_object('ok', false, 'error', 'This order uses restaurant delivery');
  end if;
  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'error', 'Customer payment is not confirmed');
  end if;

  select * into safety
  from public.food_order_safety
  where order_id = order_row.id
  for update;

  if safety.order_id is null then
    raise exception 'VASI Food delivery safety record missing';
  end if;
  if safety.pin_locked_until is not null and safety.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'Too many incorrect PIN attempts. Try again in a few minutes.'
    );
  end if;

  if supplied_pin !~ '^[0-9]{4}$' or supplied_pin <> safety.delivery_pin then
    update public.food_order_safety
    set pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
        pin_locked_until = case
          when pin_attempts >= 4 then now() + interval '5 minutes'
          else null
        end,
        updated_at = now()
    where order_id = order_row.id;
    return jsonb_build_object('ok', false, 'error', 'Incorrect delivery PIN');
  end if;

  update public.food_order_safety
  set pin_attempts = 0,
      pin_locked_until = null,
      pin_verified_at = now(),
      updated_at = now()
  where order_id = order_row.id;

  quoted_amount := coalesce(order_row.courier_offer_amount, 0);
  protected_amount := greatest(
    4.00,
    quoted_amount,
    round(coalesce(order_row.estimated_delivery_minutes, 0)::numeric * 20.00 / 60.00, 2)
  );

  perform set_config('vasi.food_pin_verified', 'on', true);
  update public.food_orders
  set status = 'delivered',
      delivered_at = now(),
      courier_offer_amount = protected_amount,
      courier_payout_status = case
        when courier.stripe_account_id is null then 'requires_onboarding'
        else 'pending'
      end
  where id = order_row.id
  returning * into order_row;

  insert into public.courier_food_earnings (
    courier_id,
    order_id,
    base_amount,
    hourly_protection_amount,
    final_amount,
    estimated_active_minutes,
    currency,
    status
  ) values (
    courier.id,
    order_row.id,
    quoted_amount,
    round(coalesce(order_row.estimated_delivery_minutes, 0)::numeric * 20.00 / 60.00, 2),
    protected_amount,
    coalesce(order_row.estimated_delivery_minutes, 0),
    order_row.currency,
    case when courier.stripe_account_id is null then 'requires_onboarding' else 'pending' end
  )
  on conflict (order_id) do nothing;

  update public.delivery_drivers
  set online = false, updated_at = now()
  where id = courier.id;

  return jsonb_build_object('ok', true, 'food_order', to_jsonb(order_row));
end;
$$;

create or replace function public.vasi_restaurant_accept_order(
  p_order_id uuid,
  p_preparation_minutes integer
)
returns public.food_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.food_orders;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if p_preparation_minutes not between 5 and 120 then
    raise exception 'Preparation time must be between 5 and 120 minutes';
  end if;

  update public.food_orders order_row
  set status = 'accepted',
      accepted_at = coalesce(order_row.accepted_at, now()),
      restaurant_preparation_minutes = p_preparation_minutes
  where order_row.id = p_order_id
    and order_row.status = 'pending'
    and order_row.payment_status = 'paid'
    and exists (
      select 1
      from public.restaurants restaurant
      where restaurant.id = order_row.restaurant_id
        and restaurant.owner_id = auth.uid()
    )
  returning order_row.* into result;

  if result.id is null then
    raise exception 'Paid pending order not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

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
  order_row public.food_orders;
  safety public.food_order_safety;
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
  from public.food_orders
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
  from public.food_order_safety
  where order_id = order_row.id
  for update;

  if safety.order_id is null then
    raise exception 'VASI Food delivery safety record missing';
  end if;
  if safety.pin_locked_until is not null and safety.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'Too many incorrect PIN attempts. Try again in a few minutes.'
    );
  end if;

  if supplied_pin !~ '^[0-9]{4}$' or supplied_pin <> safety.delivery_pin then
    update public.food_order_safety
    set pin_attempts = case when pin_attempts >= 4 then 0 else pin_attempts + 1 end,
        pin_locked_until = case
          when pin_attempts >= 4 then now() + interval '5 minutes'
          else null
        end,
        updated_at = now()
    where order_id = order_row.id;
    return jsonb_build_object('ok', false, 'error', 'Incorrect delivery PIN');
  end if;

  update public.food_order_safety
  set pin_attempts = 0,
      pin_locked_until = null,
      pin_verified_at = now(),
      updated_at = now()
  where order_id = order_row.id;

  perform set_config('vasi.food_pin_verified', 'on', true);
  update public.food_orders
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

  return jsonb_build_object('ok', true, 'food_order', to_jsonb(order_row));
end;
$$;

create or replace function public.vasi_restaurant_order_status(
  p_order_id uuid,
  p_status text
)
returns public.food_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_order public.food_orders;
begin
  select * into current_order
  from public.food_orders
  where id = p_order_id
    and restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  for update;

  if current_order.id is null then
    raise exception 'Order not found';
  end if;

  if not (
    (current_order.status = 'pending' and p_status in ('accepted', 'cancelled'))
    or (current_order.status = 'accepted' and p_status in ('preparing', 'cancelled'))
    or (current_order.status = 'preparing' and p_status = 'ready_for_pickup')
  ) then
    raise exception 'Complete the current order step first';
  end if;

  update public.food_orders
  set status = p_status
  where id = current_order.id
  returning * into current_order;

  return current_order;
end;
$$;

create or replace function public.dispatch_paid_vasi_job(
  p_service text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  driver_row record;
  pickup_latitude double precision;
  pickup_longitude double precision;
  requested_service text := case when p_service = 'eats' then 'food' else p_service end;
begin
  if requested_service = 'ride' then
    select pickup_lat, pickup_lng
      into pickup_latitude, pickup_longitude
    from public.rides
    where id = p_order_id;

    select id into driver_row
    from public.drivers
    where online = true
      and verified = true
      and coalesce(role, '') = 'ride'
      and pickup_latitude is not null
      and pickup_longitude is not null
      and latitude is not null
      and longitude is not null
    order by ST_Distance(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography
    ), created_at
    limit 1;

    if driver_row.id is null then
      return jsonb_build_object('queued', true, 'service', 'ride');
    end if;
    update public.rides
    set driver_id = driver_row.id, status = 'accepted', accepted_at = now()
    where id = p_order_id and driver_id is null;
    return jsonb_build_object('assigned', true, 'driver_id', driver_row.id, 'service', 'ride');
  elsif requested_service = 'delivery' then
    select id into driver_row
    from public.delivery_drivers
    where online = true and verified = true
      and latitude is not null and longitude is not null
    order by created_at
    limit 1;

    if driver_row.id is null then
      return jsonb_build_object('queued', true, 'service', 'delivery');
    end if;
    update public.delivery_orders
    set delivery_driver_id = driver_row.id, status = 'assigned'
    where id = p_order_id and delivery_driver_id is null;
    return jsonb_build_object('assigned', true, 'driver_id', driver_row.id, 'service', 'delivery');
  elsif requested_service = 'food' then
    select id into driver_row
    from public.delivery_drivers
    where online = true and verified = true
    order by created_at
    limit 1;

    if driver_row.id is null then
      return jsonb_build_object('queued', true, 'service', 'food');
    end if;
    update public.food_orders
    set delivery_driver_id = driver_row.id, status = 'assigned'
    where id = p_order_id and delivery_driver_id is null;
    return jsonb_build_object('assigned', true, 'driver_id', driver_row.id, 'service', 'food');
  end if;
  return jsonb_build_object('queued', true, 'service', requested_service);
end;
$$;

create or replace function public.respond_vasi_dispatch_offer(
  p_offer_id uuid,
  p_driver_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  offer_row record;
begin
  if p_response not in ('accepted', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'Invalid response');
  end if;

  select * into offer_row
  from public.vasi_dispatch_offers
  where id = p_offer_id and driver_id = p_driver_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found');
  end if;
  if offer_row.status <> 'pending' or offer_row.expires_at <= now() then
    update public.vasi_dispatch_offers
    set status = 'expired', responded_at = coalesce(responded_at, now())
    where id = p_offer_id and status = 'pending';
    return jsonb_build_object('ok', false, 'error', 'Offer expired');
  end if;

  update public.vasi_dispatch_offers
  set status = p_response, responded_at = now()
  where id = p_offer_id;

  if p_response = 'accepted' then
    if offer_row.service = 'ride' then
      update public.rides
      set driver_id = p_driver_id, status = 'accepted', accepted_at = now()
      where id = offer_row.job_id and driver_id is null;
    elsif offer_row.service in ('food', 'eats') then
      update public.food_orders
      set delivery_driver_id = p_driver_id, status = 'assigned'
      where id = offer_row.job_id and delivery_driver_id is null;
    else
      update public.delivery_orders
      set delivery_driver_id = p_driver_id, status = 'assigned'
      where id = offer_row.job_id and delivery_driver_id is null;
    end if;

    update public.vasi_dispatch_offers
    set status = 'cancelled'
    where job_id = offer_row.job_id
      and id <> offer_row.id
      and status = 'pending';
  end if;

  return jsonb_build_object('ok', true, 'status', p_response);
end;
$$;

-- Canonicalise persisted service/category values.
alter table public.push_notification_events drop constraint push_notification_events_service_check;
alter table public.support_tickets drop constraint support_tickets_category_check;
alter table public.vasi_dispatch_offers drop constraint vasi_dispatch_offers_service_check;
alter table public.vasi_orders drop constraint vasi_orders_service_check;

update public.push_notification_events set service = 'food' where service = 'eats';
update public.support_tickets set category = 'food' where category = 'eats';
update public.vasi_dispatch_offers set service = 'food' where service = 'eats';
update public.vasi_orders set service = 'food' where service = 'eats';

alter table public.push_notification_events
  add constraint push_notification_events_service_check
  check (service = any (array['ride'::text, 'food'::text, 'delivery'::text]));
alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category = any (array[
    'ride'::text,
    'food'::text,
    'delivery'::text,
    'payment'::text,
    'account'::text,
    'restaurant'::text,
    'safety'::text,
    'other'::text
  ]));
alter table public.vasi_dispatch_offers
  add constraint vasi_dispatch_offers_service_check
  check (service = any (array['ride'::text, 'food'::text, 'delivery'::text]));
alter table public.vasi_orders
  add constraint vasi_orders_service_check
  check (service = any (array['food'::text, 'delivery'::text]));

-- Replace the scheduler with the canonical food_* RPC.
do $reschedule$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'release-vasi-scheduled-eats'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'release-vasi-scheduled-food'
  ) then
    perform cron.schedule(
      'release-vasi-scheduled-food',
      '* * * * *',
      'select public.release_scheduled_food_orders();'
    );
  end if;
end
$reschedule$;

-- New tables keep the original grants and RLS policies after ALTER TABLE.
-- These extra SELECT grants activate the existing owner-scoped RLS policies.
grant select on public.food_order_safety to authenticated;
grant select on public.courier_food_earnings to authenticated;

-- Temporary compatibility layer for previously cached application versions.
create view public.eats_group_orders
with (security_invoker = true)
as select * from public.food_group_orders;

create view public.eats_group_order_members
with (security_invoker = true)
as select * from public.food_group_order_members;

create view public.eats_orders
with (security_invoker = true)
as select * from public.food_orders;

create view public.eats_order_safety
with (security_invoker = true)
as select * from public.food_order_safety;

create view public.courier_eats_earnings
with (security_invoker = true)
as select * from public.courier_food_earnings;

revoke all on public.eats_group_orders from anon, authenticated;
revoke all on public.eats_group_order_members from anon, authenticated;
revoke all on public.eats_orders from anon, authenticated;
revoke all on public.eats_order_safety from anon, authenticated;
revoke all on public.courier_eats_earnings from anon, authenticated;

grant select, insert, update, delete on public.eats_group_orders to authenticated;
grant select, insert, update, delete on public.eats_group_order_members to authenticated;
grant select on public.eats_orders to authenticated;
grant select on public.eats_order_safety to authenticated;
grant select on public.courier_eats_earnings to authenticated;

grant select, insert, update, delete on public.eats_group_orders to service_role;
grant select, insert, update, delete on public.eats_group_order_members to service_role;
grant select, insert, update, delete on public.eats_orders to service_role;
grant select, insert, update, delete on public.eats_order_safety to service_role;
grant select, insert, update, delete on public.courier_eats_earnings to service_role;

create or replace function public.release_scheduled_eats_orders()
returns integer
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select public.release_scheduled_food_orders()
$$;

revoke all on function public.release_scheduled_eats_orders() from public;
grant execute on function public.release_scheduled_eats_orders() to service_role;

create or replace function public.vasi_courier_complete_eats_order(
  p_order_id uuid,
  p_pin text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select public.vasi_courier_complete_food_order(p_order_id, p_pin)
$$;

revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from public;
grant execute on function public.vasi_courier_complete_eats_order(uuid, text) to authenticated;

notify pgrst, 'reload schema';
