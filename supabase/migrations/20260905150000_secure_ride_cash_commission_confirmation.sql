-- Keep cash commission as outstanding until Stripe confirms the card charge.
-- Only the service-role Stripe webhook may apply or release a reservation.

with reserved_allocations as (
  select allocation.debt_id, sum(allocation.amount) as amount
  from public.driver_ride_cash_offset_allocations allocation
  join public.driver_ride_cash_offsets offset_row
    on offset_row.card_ride_id = allocation.card_ride_id
  where offset_row.status = 'reserved'
  group by allocation.debt_id
)
update public.driver_cash_commission_debts debt
set
  remaining_amount = least(debt.amount, debt.remaining_amount + reserved.amount),
  settled_at = null,
  updated_at = now()
from reserved_allocations reserved
where debt.id = reserved.debt_id;

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
  already_reserved numeric(12,2) := 0;
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

    select coalesce(sum(allocation.amount), 0)
    into already_reserved
    from public.driver_ride_cash_offset_allocations allocation
    join public.driver_ride_cash_offsets offset_row
      on offset_row.card_ride_id = allocation.card_ride_id
    where allocation.debt_id = debt.id
      and offset_row.status = 'reserved';

    allocation_amount := least(
      greatest(0, debt.remaining_amount - already_reserved),
      maximum_offset - reserved_amount
    );
    if allocation_amount = 0 then
      continue;
    end if;

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
  allocation record;
begin
  select * into offset_row
  from public.driver_ride_cash_offsets
  where card_ride_id = p_ride_id
  for update;

  if offset_row.card_ride_id is null then
    return jsonb_build_object('ok', true, 'amount', 0, 'status', 'none');
  end if;
  if offset_row.status <> 'reserved' then
    return jsonb_build_object(
      'ok', true,
      'amount', offset_row.amount,
      'currency', offset_row.currency,
      'status', offset_row.status
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
      remaining_amount = greatest(0, remaining_amount - allocation.amount),
      updated_at = now(),
      settled_at = case
        when greatest(0, remaining_amount - allocation.amount) = 0 then now()
        else null
      end
    where id = allocation.debt_id;
  end loop;

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
begin
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

revoke all on function public.apply_ride_cash_commission_offset(uuid, text) from public;
revoke all on function public.apply_ride_cash_commission_offset(uuid, text) from anon;
revoke all on function public.apply_ride_cash_commission_offset(uuid, text) from authenticated;
revoke all on function public.release_ride_cash_commission_offset(uuid) from public;
revoke all on function public.release_ride_cash_commission_offset(uuid) from anon;
revoke all on function public.release_ride_cash_commission_offset(uuid) from authenticated;

grant execute on function public.apply_ride_cash_commission_offset(uuid, text) to service_role;
grant execute on function public.release_ride_cash_commission_offset(uuid) to service_role;

comment on function public.apply_ride_cash_commission_offset(uuid, text) is
  'Applies a reserved cash commission offset after a Stripe-signed success event. Service role only.';
comment on function public.release_ride_cash_commission_offset(uuid) is
  'Releases a reserved cash commission offset after a Stripe-signed failure or cancellation event. Service role only.';
