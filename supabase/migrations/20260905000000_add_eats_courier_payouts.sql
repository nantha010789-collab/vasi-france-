alter table public.delivery_drivers
  add column if not exists stripe_account_id text,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

create unique index if not exists delivery_drivers_stripe_account_unique
  on public.delivery_drivers (stripe_account_id)
  where stripe_account_id is not null;

alter table public.eats_orders
  add column if not exists service_fee numeric(10,2) not null default 0,
  add column if not exists delivery_mode text not null default 'vasi',
  add column if not exists delivery_distance_km numeric(10,2),
  add column if not exists estimated_delivery_minutes integer,
  add column if not exists courier_offer_amount numeric(10,2) not null default 0,
  add column if not exists accepted_at timestamptz,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists stripe_payment_intent_id text,
  add column if not exists courier_payout_status text not null default 'not_ready',
  add column if not exists courier_transfer_id text,
  add column if not exists courier_paid_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eats_orders_delivery_mode_check'
  ) then
    alter table public.eats_orders
      add constraint eats_orders_delivery_mode_check
      check (delivery_mode in ('vasi', 'own'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'eats_orders_payment_status_check'
  ) then
    alter table public.eats_orders
      add constraint eats_orders_payment_status_check
      check (payment_status in ('unpaid', 'requires_payment', 'paid', 'failed', 'refunded'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'eats_orders_courier_payout_status_check'
  ) then
    alter table public.eats_orders
      add constraint eats_orders_courier_payout_status_check
      check (courier_payout_status in ('not_ready', 'pending', 'requires_onboarding', 'paid', 'failed'));
  end if;
end
$$;

create unique index if not exists eats_orders_stripe_payment_intent_unique
  on public.eats_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists eats_orders_courier_transfer_unique
  on public.eats_orders (courier_transfer_id)
  where courier_transfer_id is not null;

create table if not exists public.courier_eats_earnings (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.delivery_drivers(id) on delete restrict,
  order_id uuid not null unique references public.eats_orders(id) on delete restrict,
  base_amount numeric(10,2) not null check (base_amount >= 0),
  hourly_protection_amount numeric(10,2) not null check (hourly_protection_amount >= 0),
  final_amount numeric(10,2) not null check (final_amount >= 0),
  estimated_active_minutes integer not null check (estimated_active_minutes >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'pending'
    check (status in ('pending', 'requires_onboarding', 'paid', 'failed')),
  stripe_transfer_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.courier_eats_earnings enable row level security;

revoke all on table public.courier_eats_earnings from anon;
revoke all on table public.courier_eats_earnings from authenticated;
grant select (
  id, courier_id, order_id, base_amount, hourly_protection_amount,
  final_amount, estimated_active_minutes, currency, status,
  stripe_transfer_id, failure_reason, created_at, paid_at, updated_at
) on table public.courier_eats_earnings to authenticated;

drop policy if exists courier_reads_own_eats_earnings on public.courier_eats_earnings;
create policy courier_reads_own_eats_earnings
on public.courier_eats_earnings
for select
to authenticated
using (
  exists (
    select 1
    from public.delivery_drivers courier
    where courier.id = courier_eats_earnings.courier_id
      and courier.user_id = (select auth.uid())
  )
);

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
  from public.eats_orders
  where id = p_order_id and delivery_driver_id = courier.id
  for update;

  if order_row.id is null then
    raise exception 'Eats order not assigned to this courier' using errcode = '42501';
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

  quoted_amount := coalesce(order_row.courier_offer_amount, 0);
  protected_amount := greatest(
    4.00,
    quoted_amount,
    round(coalesce(order_row.estimated_delivery_minutes, 0)::numeric * 20.00 / 60.00, 2)
  );

  perform set_config('vasi.eats_pin_verified', 'on', true);
  update public.eats_orders
  set
    status = 'delivered',
    delivered_at = now(),
    courier_offer_amount = protected_amount,
    courier_payout_status = case
      when courier.stripe_account_id is null then 'requires_onboarding'
      else 'pending'
    end
  where id = order_row.id
  returning * into order_row;

  insert into public.courier_eats_earnings (
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

  return jsonb_build_object('ok', true, 'eat', to_jsonb(order_row));
end;
$$;

revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from public;
revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from anon;
revoke all on function public.vasi_courier_complete_eats_order(uuid, text) from authenticated;
grant execute on function public.vasi_courier_complete_eats_order(uuid, text) to authenticated;

comment on table public.courier_eats_earnings is
  'Server-managed VASI Eats courier earnings and Stripe transfer state.';
comment on column public.eats_orders.courier_offer_amount is
  'Courier amount shown before acceptance. Includes the VASI EUR 4 minimum and EUR 20 estimated active-hour protection.';
