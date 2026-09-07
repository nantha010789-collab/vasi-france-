-- Add user-controlled account deletion requests, Web Push subscriptions and
-- explicit Google Pay support for ride commission recovery.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (
    status in ('requested', 'processing', 'completed', 'cancelled', 'rejected')
  ),
  reason text check (reason is null or char_length(reason) <= 500),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000)
);

create unique index if not exists account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'processing');

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select on table public.account_deletion_requests to authenticated;
grant insert (user_id, reason) on table public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own
  on public.account_deletion_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'requested');

comment on table public.account_deletion_requests is
  'User-initiated deletion requests. Service-role administration preserves legally required transaction records.';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth_key text not null check (char_length(auth_key) between 8 and 256),
  role text not null default 'customer' check (
    role in ('customer', 'driver', 'courier', 'restaurant', 'admin')
  ),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, active)
  where active;

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.push_subscriptions is
  'Per-device Web Push subscriptions. Private key material stays in server-side environment variables.';

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
     or lower(coalesce(ride.payment_method, 'cash')) not in ('card', 'apple_pay', 'google_pay') then
    raise exception 'Cash commission can only be offset against a completed card or wallet ride';
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
    card_ride_id, driver_id, amount, currency, status
  ) values (
    ride.id, ride.driver_id, 0, upper(coalesce(ride.currency, 'EUR')), 'reserved'
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
      card_ride_id, debt_id, amount
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

revoke all on function public.reserve_ride_cash_commission_offset(uuid) from public, anon;
grant execute on function public.reserve_ride_cash_commission_offset(uuid) to authenticated;
