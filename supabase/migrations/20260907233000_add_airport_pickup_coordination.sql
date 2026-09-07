-- Coordinates airport passengers and drivers after live flight tracking.

alter table public.rides
  add column if not exists passenger_count smallint not null default 1,
  add column if not exists luggage_count smallint not null default 0,
  add column if not exists customer_arrival_terminal text,
  add column if not exists airport_pickup_zone text,
  add column if not exists customer_ready_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rides_passenger_count_check') then
    alter table public.rides add constraint rides_passenger_count_check
      check (passenger_count between 1 and 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_luggage_count_check') then
    alter table public.rides add constraint rides_luggage_count_check
      check (luggage_count between 0 and 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_customer_arrival_terminal_length') then
    alter table public.rides add constraint rides_customer_arrival_terminal_length
      check (customer_arrival_terminal is null or char_length(customer_arrival_terminal) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_airport_pickup_zone_length') then
    alter table public.rides add constraint rides_airport_pickup_zone_length
      check (airport_pickup_zone is null or char_length(airport_pickup_zone) <= 120);
  end if;
end;
$$;

create or replace function public.vasi_set_airport_booking_details(
  p_ride_id uuid,
  p_passenger_count integer default 1,
  p_luggage_count integer default 0,
  p_customer_arrival_terminal text default null,
  p_airport_pickup_zone text default null
)
returns public.rides
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_ride public.rides;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_passenger_count not between 1 and 8 then raise exception 'Passenger count must be between 1 and 8'; end if;
  if p_luggage_count not between 0 and 8 then raise exception 'Luggage count must be between 0 and 8'; end if;

  update public.rides
  set passenger_count = p_passenger_count,
      luggage_count = p_luggage_count,
      customer_arrival_terminal = nullif(left(trim(coalesce(p_customer_arrival_terminal, '')), 40), ''),
      airport_pickup_zone = nullif(left(trim(coalesce(p_airport_pickup_zone, '')), 120), '')
  where id = p_ride_id
    and customer_id = auth.uid()
    and airport_pickup = true
    and status = 'requested'
  returning * into updated_ride;

  if updated_ride.id is null then raise exception 'Airport ride not found or cannot be changed'; end if;
  return updated_ride;
end;
$$;

revoke all on function public.vasi_set_airport_booking_details(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.vasi_set_airport_booking_details(uuid, integer, integer, text, text) to authenticated;

create or replace function public.vasi_customer_airport_ready(p_ride_id uuid, p_ready boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_ride public.rides;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  update public.rides
  set customer_ready_at = case when coalesce(p_ready, true) then now() else null end
  where id = p_ride_id
    and customer_id = auth.uid()
    and airport_pickup = true
    and status in ('accepted', 'driver_arriving')
  returning * into updated_ride;

  if updated_ride.id is null then raise exception 'Airport ride is not ready for this action'; end if;
  return jsonb_build_object('ok', true, 'ride', to_jsonb(updated_ride));
end;
$$;

revoke all on function public.vasi_customer_airport_ready(uuid, boolean) from public, anon;
grant execute on function public.vasi_customer_airport_ready(uuid, boolean) to authenticated;

create or replace function public.enqueue_vasi_airport_ready_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  hook_secret text;
begin
  if new.customer_ready_at is not distinct from old.customer_ready_at then return new; end if;
  if new.customer_ready_at is null or new.driver_id is null then return new; end if;

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
      'event', 'airport_ready',
      'record', jsonb_build_object('id', new.id, 'status', 'customer_ready')
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function public.enqueue_vasi_airport_ready_push() from public, anon, authenticated;

drop trigger if exists rides_airport_ready_push on public.rides;
create trigger rides_airport_ready_push
after update of customer_ready_at on public.rides
for each row execute function public.enqueue_vasi_airport_ready_push();

comment on column public.rides.customer_ready_at is 'Time the arriving passenger said they are ready at the airport pickup point.';
comment on column public.rides.airport_pickup_zone is 'Customer-entered airport pickup zone or meeting point.';
