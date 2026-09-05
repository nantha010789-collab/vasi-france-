-- Automatically recover commission owed on completed cash rides from the
-- driver's next card-ride earnings before Stripe releases the bank payout.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.driver_cash_commission_debts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  cash_ride_id uuid not null unique references public.rides(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  remaining_amount numeric(12,2) not null check (
    remaining_amount >= 0 and remaining_amount <= amount
  ),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists driver_cash_commission_debts_open_idx
  on public.driver_cash_commission_debts (driver_id, created_at, id)
  where remaining_amount > 0;

alter table public.driver_cash_commission_debts enable row level security;
revoke all on table public.driver_cash_commission_debts from public;
revoke all on table public.driver_cash_commission_debts from anon;
revoke all on table public.driver_cash_commission_debts from authenticated;

create table if not exists public.driver_ride_cash_offsets (
  card_ride_id uuid primary key references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'reserved' check (
    status in ('reserved', 'applied', 'released')
  ),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists driver_ride_cash_offsets_driver_idx
  on public.driver_ride_cash_offsets (driver_id, created_at desc);

alter table public.driver_ride_cash_offsets enable row level security;
revoke all on table public.driver_ride_cash_offsets from public;
revoke all on table public.driver_ride_cash_offsets from anon;
revoke all on table public.driver_ride_cash_offsets from authenticated;

create table if not exists public.driver_ride_cash_offset_allocations (
  card_ride_id uuid not null references public.driver_ride_cash_offsets(card_ride_id) on delete cascade,
  debt_id uuid not null references public.driver_cash_commission_debts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  primary key (card_ride_id, debt_id)
);

alter table public.driver_ride_cash_offset_allocations enable row level security;
revoke all on table public.driver_ride_cash_offset_allocations from public;
revoke all on table public.driver_ride_cash_offset_allocations from anon;
revoke all on table public.driver_ride_cash_offset_allocations from authenticated;

create or replace function private.vasi_record_cash_ride_commission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  debt_amount numeric(12,2);
begin
  if new.status::text <> 'completed'
     or lower(coalesce(new.payment_method, 'cash')) <> 'cash'
     or new.driver_id is null then
    return new;
  end if;

  debt_amount := round(greatest(0, coalesce(new.vasi_commission, 0))::numeric, 2);
  if debt_amount = 0 then
    return new;
  end if;

  insert into public.driver_cash_commission_debts (
    driver_id,
    cash_ride_id,
    amount,
    remaining_amount,
    currency
  ) values (
    new.driver_id,
    new.id,
    debt_amount,
    debt_amount,
    upper(coalesce(new.currency, 'EUR'))
  )
  on conflict (cash_ride_id) do update
  set
    driver_id = excluded.driver_id,
    amount = excluded.amount,
    remaining_amount = greatest(
      0,
      excluded.amount - (
        public.driver_cash_commission_debts.amount
        - public.driver_cash_commission_debts.remaining_amount
      )
    ),
    currency = excluded.currency,
    updated_at = now(),
    settled_at = case
      when greatest(
        0,
        excluded.amount - (
          public.driver_cash_commission_debts.amount
          - public.driver_cash_commission_debts.remaining_amount
        )
      ) = 0 then coalesce(public.driver_cash_commission_debts.settled_at, now())
      else null
    end;

  return new;
end;
$$;

revoke all on function private.vasi_record_cash_ride_commission() from public;
revoke all on function private.vasi_record_cash_ride_commission() from anon;
revoke all on function private.vasi_record_cash_ride_commission() from authenticated;

drop trigger if exists rides_record_cash_commission on public.rides;
create trigger rides_record_cash_commission
after insert or update of status, final_fare, vasi_commission, payment_method, driver_id
on public.rides
for each row execute function private.vasi_record_cash_ride_commission();

insert into public.driver_cash_commission_debts (
  driver_id,
  cash_ride_id,
  amount,
  remaining_amount,
  currency
)
select
  ride.driver_id,
  ride.id,
  round(ride.vasi_commission::numeric, 2),
  round(ride.vasi_commission::numeric, 2),
  upper(coalesce(ride.currency, 'EUR'))
from public.rides ride
where ride.status::text = 'completed'
  and lower(coalesce(ride.payment_method, 'cash')) = 'cash'
  and ride.driver_id is not null
  and coalesce(ride.vasi_commission, 0) > 0
on conflict (cash_ride_id) do nothing;

create or replace function public.reserve_ride_cash_commission_offset(
  p_ride_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ride public.rides;
  existing public.driver_ride_cash_offsets;
  debt public.driver_cash_commission_debts;
  maximum_offset numeric(12,2) := 0;
  reserved_amount numeric(12,2) := 0;
  allocation_amount numeric(12,2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select r.* into ride
  from public.rides r
  join public.drivers d on d.id = r.driver_id
  where r.id = p_ride_id
    and d.user_id = auth.uid()
  for update of r;

  if ride.id is null then
    raise exception 'Driver card ride not found' using errcode = '42501';
  end if;
  if ride.status::text <> 'completed'
     or lower(coalesce(ride.payment_method, 'cash')) not in ('card', 'apple_pay') then
    raise exception 'Cash commission can only be offset against a completed card ride';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(ride.driver_id::text, 0));

  select * into existing
  from public.driver_ride_cash_offsets
  where card_ride_id = ride.id
  for update;

  if existing.card_ride_id is not null and existing.status in ('reserved', 'applied') then
    return jsonb_build_object(
      'ok', true,
      'amount', existing.amount,
      'currency', existing.currency,
      'status', existing.status
    );
  end if;

  if existing.card_ride_id is not null then
    delete from public.driver_ride_cash_offset_allocations
    where card_ride_id = ride.id;
    delete from public.driver_ride_cash_offsets
    where card_ride_id = ride.id;
  end if;

  maximum_offset := round(greatest(0, coalesce(ride.driver_amount, 0))::numeric, 2);
  if maximum_offset = 0 then
    return jsonb_build_object('ok', true, 'amount', 0, 'currency', ride.currency, 'status', 'none');
  end if;

  insert into public.driver_ride_cash_offsets (
    card_ride_id,
    driver_id,
    amount,
    currency,
    status
  ) values (
    ride.id,
    ride.driver_id,
    0,
    upper(coalesce(ride.currency, 'EUR')),
    'reserved'
  );

  for debt in
    select d.*
    from public.driver_cash_commission_debts d
    where d.driver_id = ride.driver_id
      and d.remaining_amount > 0
      and d.currency = upper(coalesce(ride.currency, 'EUR'))
    order by d.created_at, d.id
    for update
  loop
    exit when reserved_amount >= maximum_offset;
    allocation_amount := least(
      debt.remaining_amount,
      maximum_offset - reserved_amount
    );

    update public.driver_cash_commission_debts
    set
      remaining_amount = remaining_amount - allocation_amount,
      updated_at = now(),
      settled_at = case
        when remaining_amount - allocation_amount = 0 then now()
        else null
      end
    where id = debt.id;

    insert into public.driver_ride_cash_offset_allocations (
      card_ride_id,
      debt_id,
      amount
    ) values (ride.id, debt.id, allocation_amount);

    reserved_amount := reserved_amount + allocation_amount;
  end loop;

  if reserved_amount = 0 then
    delete from public.driver_ride_cash_offsets where card_ride_id = ride.id;
    return jsonb_build_object('ok', true, 'amount', 0, 'currency', ride.currency, 'status', 'none');
  end if;

  update public.driver_ride_cash_offsets
  set amount = reserved_amount, updated_at = now()
  where card_ride_id = ride.id;

  return jsonb_build_object(
    'ok', true,
    'amount', reserved_amount,
    'currency', upper(coalesce(ride.currency, 'EUR')),
    'status', 'reserved'
  );
end;
$$;

create or replace function public.apply_ride_cash_commission_offset(
  p_ride_id uuid,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  offset_row public.driver_ride_cash_offsets;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.rides r
    join public.drivers d on d.id = r.driver_id
    where r.id = p_ride_id and d.user_id = auth.uid()
  ) then
    raise exception 'Driver card ride not found' using errcode = '42501';
  end if;

  select * into offset_row
  from public.driver_ride_cash_offsets
  where card_ride_id = p_ride_id
  for update;

  if offset_row.card_ride_id is null then
    return jsonb_build_object('ok', true, 'amount', 0, 'status', 'none');
  end if;

  if offset_row.status = 'reserved' then
    update public.driver_ride_cash_offsets
    set
      status = 'applied',
      stripe_payment_intent_id = coalesce(
        nullif(p_stripe_payment_intent_id, ''),
        stripe_payment_intent_id
      ),
      applied_at = now(),
      updated_at = now()
    where card_ride_id = p_ride_id
    returning * into offset_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'amount', offset_row.amount,
    'currency', offset_row.currency,
    'status', offset_row.status
  );
end;
$$;

create or replace function public.release_ride_cash_commission_offset(
  p_ride_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  offset_row public.driver_ride_cash_offsets;
  allocation record;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.rides r
    join public.drivers d on d.id = r.driver_id
    where r.id = p_ride_id and d.user_id = auth.uid()
  ) then
    raise exception 'Driver card ride not found' using errcode = '42501';
  end if;

  select * into offset_row
  from public.driver_ride_cash_offsets
  where card_ride_id = p_ride_id
  for update;

  if offset_row.card_ride_id is null or offset_row.status <> 'reserved' then
    return jsonb_build_object(
      'ok', true,
      'amount', coalesce(offset_row.amount, 0),
      'status', coalesce(offset_row.status, 'none')
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(offset_row.driver_id::text, 0));
  for allocation in
    select *
    from public.driver_ride_cash_offset_allocations
    where card_ride_id = p_ride_id
  loop
    update public.driver_cash_commission_debts
    set
      remaining_amount = least(amount, remaining_amount + allocation.amount),
      settled_at = null,
      updated_at = now()
    where id = allocation.debt_id;
  end loop;

  update public.driver_ride_cash_offsets
  set status = 'released', updated_at = now()
  where card_ride_id = p_ride_id;

  return jsonb_build_object(
    'ok', true,
    'amount', offset_row.amount,
    'currency', offset_row.currency,
    'status', 'released'
  );
end;
$$;

create or replace function public.get_driver_cash_commission_balance()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  driver_id_value uuid;
  balance_amount numeric(12,2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select d.id into driver_id_value
  from public.drivers d
  where d.user_id = auth.uid()
    and coalesce(d.role, 'ride') in ('ride', 'driver', 'ride_driver')
  limit 1;

  if driver_id_value is null then
    raise exception 'Ride driver profile required' using errcode = '42501';
  end if;

  select coalesce(sum(d.remaining_amount), 0)
  into balance_amount
  from public.driver_cash_commission_debts d
  where d.driver_id = driver_id_value
    and d.currency = 'EUR';

  return jsonb_build_object(
    'ok', true,
    'cash_commission_debt', round(balance_amount, 2),
    'currency', 'EUR'
  );
end;
$$;

revoke all on function public.reserve_ride_cash_commission_offset(uuid) from public;
revoke all on function public.reserve_ride_cash_commission_offset(uuid) from anon;
revoke all on function public.apply_ride_cash_commission_offset(uuid, text) from public;
revoke all on function public.apply_ride_cash_commission_offset(uuid, text) from anon;
revoke all on function public.release_ride_cash_commission_offset(uuid) from public;
revoke all on function public.release_ride_cash_commission_offset(uuid) from anon;
revoke all on function public.get_driver_cash_commission_balance() from public;
revoke all on function public.get_driver_cash_commission_balance() from anon;

grant execute on function public.reserve_ride_cash_commission_offset(uuid) to authenticated;
grant execute on function public.apply_ride_cash_commission_offset(uuid, text) to authenticated;
grant execute on function public.release_ride_cash_commission_offset(uuid) to authenticated;
grant execute on function public.get_driver_cash_commission_balance() to authenticated;

comment on table public.driver_cash_commission_debts is
  'Commission owed to VASI from completed cash rides, recovered from future card-ride earnings.';
comment on table public.driver_ride_cash_offsets is
  'Idempotent cash-commission amounts withheld from card-ride Stripe transfers.';
