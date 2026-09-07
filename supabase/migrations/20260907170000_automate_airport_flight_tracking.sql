-- Automatic airport flight tracking, pickup adjustment, notifications and waiting policy.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.rides
  add column if not exists flight_booked_pickup_at timestamptz,
  add column if not exists flight_scheduled_arrival_at timestamptz,
  add column if not exists flight_estimated_arrival_at timestamptz,
  add column if not exists flight_actual_arrival_at timestamptz,
  add column if not exists flight_arrival_airport text,
  add column if not exists flight_arrival_terminal text,
  add column if not exists flight_arrival_gate text,
  add column if not exists flight_arrival_baggage text,
  add column if not exists flight_delay_minutes integer,
  add column if not exists flight_timing text not null default 'unknown',
  add column if not exists flight_tracking_error text,
  add column if not exists flight_pickup_buffer_minutes integer not null default 30;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rides_flight_timing_check') then
    alter table public.rides add constraint rides_flight_timing_check
      check (flight_timing in ('unknown', 'on_time', 'early', 'delayed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_flight_pickup_buffer_check') then
    alter table public.rides add constraint rides_flight_pickup_buffer_check
      check (flight_pickup_buffer_minutes between 0 and 180);
  end if;
end;
$$;

create index if not exists rides_active_airport_schedule_idx
  on public.rides (scheduled_for, flight_status_checked_at)
  where airport_pickup = true and flight_number is not null
    and status in ('requested', 'accepted', 'driver_arriving');

create or replace function public.get_vasi_flight_sync_credentials()
returns table (api_key text, hook_secret text)
language sql
security definer
set search_path = pg_catalog, public, vault
as $$
  select
    max(decrypted_secret) filter (where name = 'vasi_aviationstack_api_key'),
    max(decrypted_secret) filter (where name = 'vasi_push_hook_secret')
  from vault.decrypted_secrets
  where name in ('vasi_aviationstack_api_key', 'vasi_push_hook_secret');
$$;

revoke all on function public.get_vasi_flight_sync_credentials() from public, anon, authenticated;
grant execute on function public.get_vasi_flight_sync_credentials() to service_role;

create or replace function public.enqueue_vasi_flight_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  hook_secret text;
begin
  if not new.airport_pickup or new.flight_number is null then return new; end if;
  if new.flight_status is not distinct from old.flight_status
    and new.flight_timing is not distinct from old.flight_timing
    and new.flight_delay_minutes is not distinct from old.flight_delay_minutes
    and new.scheduled_for is not distinct from old.scheduled_for then
    return new;
  end if;

  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'vasi_push_hook_secret'
  limit 1;
  if hook_secret is null then return new; end if;

  perform net.http_post(
    url := 'https://vhfyvkrvysrooaqzcxsp.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vasi-hook-secret', hook_secret),
    body := jsonb_build_object(
      'table', 'rides',
      'event', 'flight',
      'record', jsonb_build_object('id', new.id, 'status', new.flight_status)
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function public.enqueue_vasi_flight_push() from public, anon, authenticated;

drop trigger if exists rides_flight_push_update on public.rides;
create trigger rides_flight_push_update
after update of flight_status, flight_timing, flight_delay_minutes, scheduled_for on public.rides
for each row execute function public.enqueue_vasi_flight_push();

-- Airport pickups have 45 minutes free waiting; premium/large vehicles have 60 minutes.
create or replace function public.apply_vasi_waiting_fee_policy()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  grace_seconds integer := 180;
begin
  if new.status::text = 'in_progress' and old.status::text = 'driver_arriving' and new.arrived_at is not null then
    if coalesce(new.airport_pickup, false) then
      grace_seconds := case
        when lower(coalesce(new.service, '')) ~ '(comfort|xl|van|premium)' then 3600
        else 2700
      end;
    end if;
    new.waiting_fee := greatest(
      0,
      ceil(greatest(0, extract(epoch from (now() - new.arrived_at)) - grace_seconds) / 60.0) * 0.30
    );
  end if;
  return new;
end;
$$;

revoke all on function public.apply_vasi_waiting_fee_policy() from public, anon, authenticated;

drop trigger if exists rides_waiting_fee_policy on public.rides;
create trigger rides_waiting_fee_policy
before update of status on public.rides
for each row execute function public.apply_vasi_waiting_fee_policy();

drop function if exists public.get_customer_ride_history_v2(integer);
create function public.get_customer_ride_history_v2(p_limit integer default 50)
returns table (
  id uuid,
  pickup_address text,
  destination_address text,
  service text,
  status public.ride_status,
  payment_method text,
  payment_status text,
  currency text,
  estimated_fare numeric,
  final_fare numeric,
  waiting_fee numeric,
  cancellation_fee numeric,
  requested_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  driver_name text,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  scheduled_for timestamptz,
  airport_pickup boolean,
  flight_number text,
  flight_status text,
  flight_timing text,
  flight_delay_minutes integer,
  flight_estimated_arrival_at timestamptz,
  flight_actual_arrival_at timestamptz,
  flight_arrival_terminal text,
  flight_arrival_gate text,
  flight_arrival_baggage text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id, r.pickup_address, r.destination_address, r.service, r.status,
    r.payment_method,
    coalesce(
      (select p.status from public.payments p where p.ride_id = r.id and p.customer_id = auth.uid() order by p.created_at desc limit 1),
      case when lower(coalesce(r.payment_method, 'cash')) = 'cash' then 'cash' else 'not_authorized' end
    ) as payment_status,
    r.currency, r.estimated_fare, r.final_fare,
    r.waiting_fee, r.cancellation_fee, r.requested_at, r.completed_at, r.cancelled_at,
    d.full_name, d.vehicle_make, d.vehicle_model, d.vehicle_plate,
    r.scheduled_for, r.airport_pickup, r.flight_number, r.flight_status, r.flight_timing,
    r.flight_delay_minutes, r.flight_estimated_arrival_at, r.flight_actual_arrival_at,
    r.flight_arrival_terminal, r.flight_arrival_gate, r.flight_arrival_baggage
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  where auth.uid() is not null and r.customer_id = auth.uid()
  order by r.requested_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.get_customer_ride_history_v2(integer) from public, anon;
grant execute on function public.get_customer_ride_history_v2(integer) to authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'sync-vasi-flight-status' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end;
$$;

select cron.schedule(
  'sync-vasi-flight-status',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := 'https://vhfyvkrvysrooaqzcxsp.supabase.co/functions/v1/flight-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-vasi-hook-secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'vasi_push_hook_secret' limit 1
        )
      ),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 15000
    );
  $cron$
);

comment on column public.rides.flight_booked_pickup_at is 'Customer-selected pickup before automatic flight adjustments.';
comment on column public.rides.flight_pickup_buffer_minutes is 'Minutes after the best-known arrival time used for pickup.';
