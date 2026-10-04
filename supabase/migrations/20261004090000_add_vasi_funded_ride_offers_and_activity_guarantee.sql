-- VASI-funded customer offers and the French EUR 30/activity-hour guarantee.
-- Existing rides remain on the legacy settlement model and are never rewritten.

alter table public.rides
  add column if not exists fare_model text not null default 'legacy',
  add column if not exists platform_funded_discount numeric not null default 0,
  add column if not exists gross_vasi_commission numeric not null default 0,
  add column if not exists estimated_distance_km numeric,
  add column if not exists estimated_duration_minutes integer;

alter table public.rides
  drop constraint if exists rides_fare_model_check,
  add constraint rides_fare_model_check
    check (fare_model in ('legacy', 'vasi_funded_v1')),
  drop constraint if exists rides_platform_funded_discount_check,
  add constraint rides_platform_funded_discount_check
    check (platform_funded_discount >= 0),
  drop constraint if exists rides_gross_vasi_commission_check,
  add constraint rides_gross_vasi_commission_check
    check (gross_vasi_commission >= 0),
  drop constraint if exists rides_estimated_distance_check,
  add constraint rides_estimated_distance_check
    check (estimated_distance_km is null or estimated_distance_km >= 0),
  drop constraint if exists rides_estimated_duration_check,
  add constraint rides_estimated_duration_check
    check (estimated_duration_minutes is null or estimated_duration_minutes >= 0);

create or replace function public.vasi_apply_ride_commission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  configured_percent numeric := 12;
  settlement_fare numeric := 0;
  customer_fare numeric := 0;
  driver_floor numeric := 9;
begin
  if tg_op = 'INSERT' then
    select coalesce(settings.ride_commission_percent, 12)
      into configured_percent
    from public.vasi_pricing_settings settings
    where settings.id = 'active';
    new.commission_percent := greatest(0, least(50, coalesce(configured_percent, 12)));
  else
    new.commission_percent := old.commission_percent;
    new.fare_model := old.fare_model;
  end if;

  customer_fare := case
    when new.status::text = 'completed' and new.final_fare is not null then new.final_fare
    else coalesce(new.estimated_fare, 0)
  end;

  if new.fare_model = 'vasi_funded_v1' then
    settlement_fare := case
      when new.status::text = 'completed' and new.final_fare is not null
        then new.final_fare + coalesce(new.platform_funded_discount, 0)
      else coalesce(new.regular_fare, new.estimated_fare, 0)
    end;
    new.platform_funded_discount := round(settlement_fare - customer_fare, 2);
    new.customer_discount := new.platform_funded_discount;
    new.gross_vasi_commission := round(settlement_fare * new.commission_percent / 100, 2);
    if new.platform_funded_discount < 0
       or new.platform_funded_discount > new.gross_vasi_commission then
      raise exception 'VASI-funded discount cannot exceed VASI gross commission'
        using errcode = '22023';
    end if;
    new.driver_amount := round(settlement_fare - new.gross_vasi_commission, 2);
    new.vasi_commission := round(new.gross_vasi_commission - new.platform_funded_discount, 2);
    driver_floor := greatest(
      9,
      ceil(coalesce(new.estimated_distance_km, 0) * 101) / 100
    );
    if new.driver_amount < driver_floor then
      raise exception 'Ride fare does not protect the required driver payout'
        using errcode = '22023';
    end if;
    if abs(customer_fare - (new.driver_amount + new.vasi_commission)) > 0.01 then
      raise exception 'VASI-funded fare breakdown mismatch'
        using errcode = '22023';
    end if;
  else
    settlement_fare := customer_fare;
    new.gross_vasi_commission := round(settlement_fare * new.commission_percent / 100, 2);
    new.platform_funded_discount := 0;
    new.vasi_commission := new.gross_vasi_commission;
    new.driver_amount := round(settlement_fare - new.vasi_commission, 2);
    if tg_op = 'INSERT' and new.driver_amount < 9 then
      raise exception 'Ride fare must protect a minimum driver payout of EUR 9'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.vasi_apply_ride_commission() from public, anon, authenticated;

drop trigger if exists vasi_apply_ride_commission on public.rides;
create trigger vasi_apply_ride_commission
before insert or update of
  estimated_fare,
  regular_fare,
  final_fare,
  customer_discount,
  platform_funded_discount,
  gross_vasi_commission,
  estimated_distance_km,
  fare_model,
  status,
  commission_percent,
  vasi_commission,
  driver_amount
on public.rides
for each row execute function public.vasi_apply_ride_commission();

drop function if exists public.create_customer_ride(
  text,double precision,double precision,text,double precision,double precision,
  text,text,numeric,text,timestamptz,text,text,text,numeric,numeric,numeric,numeric,
  boolean,text,text[],uuid,text
);

create function public.create_customer_ride(
 p_pickup_address text,p_pickup_lat double precision,p_pickup_lng double precision,p_destination_address text,
 p_destination_lat double precision default null,p_destination_lng double precision default null,p_service text default 'VASI Go',
 p_payment_method text default 'cash',p_estimated_fare numeric default 0,p_currency text default 'EUR',p_scheduled_for timestamptz default null,
 p_passenger_name text default null,p_passenger_phone text default null,p_notes text default null,p_regular_fare numeric default 0,
 p_customer_discount numeric default 0,p_driver_amount numeric default 0,p_vasi_commission numeric default 0,
 p_airport_pickup boolean default false,p_flight_number text default null,p_service_options text[] default '{}'::text[],
 p_business_account_id uuid default null,p_company_reference text default null,
 p_fare_model text default 'legacy',p_platform_funded_discount numeric default 0,
 p_estimated_distance_km numeric default null,p_estimated_duration_minutes integer default null
) returns public.rides language plpgsql set search_path='public'
as $function$
declare r public.rides; ride_mode text:='ride'; clean_flight text;
begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 if p_estimated_fare<0 or p_regular_fare<p_estimated_fare or p_customer_discount<0 or p_driver_amount<0 or p_vasi_commission<0 then raise exception 'Invalid fare breakdown'; end if;
 if abs((p_regular_fare-p_customer_discount)-p_estimated_fare)>0.02 then raise exception 'Fare breakdown mismatch'; end if;
 if p_driver_amount>p_regular_fare then raise exception 'Invalid driver amount'; end if;
 if p_fare_model not in ('legacy','vasi_funded_v1') then raise exception 'Unsupported fare model'; end if;
 if p_fare_model='vasi_funded_v1' and abs(p_platform_funded_discount-p_customer_discount)>0.01 then raise exception 'Funded discount mismatch'; end if;
 if p_estimated_distance_km is not null and p_estimated_distance_km<0 then raise exception 'Invalid distance'; end if;
 if p_estimated_duration_minutes is not null and p_estimated_duration_minutes<0 then raise exception 'Invalid duration'; end if;
 if p_scheduled_for is not null then
   if p_scheduled_for<now()+interval '30 minutes' then raise exception 'Scheduled pickup must be at least 30 minutes from now'; end if;
   if p_scheduled_for>now()+interval '90 days' then raise exception 'Scheduled pickup must be within 90 days'; end if;
   ride_mode:='reserve';
 end if;
 if not coalesce(p_service_options,'{}'::text[]) <@ array['wheelchair_accessible','child_seat','pet_friendly']::text[] then raise exception 'Unsupported ride option'; end if;
 clean_flight:=upper(replace(trim(coalesce(p_flight_number,'')),' ',''));
 if p_airport_pickup and clean_flight<>'' and clean_flight !~ '^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$' then raise exception 'Enter a valid flight number'; end if;
 if p_business_account_id is not null and not exists(select 1 from public.business_members where business_id=p_business_account_id and user_id=auth.uid() and active) then raise exception 'Business account access required'; end if;
 insert into public.rides(
   customer_id,pickup_address,pickup_lat,pickup_lng,destination_address,destination_lat,destination_lng,
   currency,estimated_fare,regular_fare,customer_discount,driver_amount,vasi_commission,status,requested_at,
   mode,service,payment_method,scheduled_for,passenger_name,passenger_phone,notes,airport_pickup,flight_number,
   flight_status,service_options,business_account_id,company_reference,fare_model,platform_funded_discount,
   estimated_distance_km,estimated_duration_minutes
 ) values(
   auth.uid(),p_pickup_address,p_pickup_lat,p_pickup_lng,p_destination_address,p_destination_lat,p_destination_lng,
   p_currency,p_estimated_fare,p_regular_fare,p_customer_discount,p_driver_amount,p_vasi_commission,'requested',now(),
   ride_mode,p_service,p_payment_method,p_scheduled_for,p_passenger_name,p_passenger_phone,p_notes,
   coalesce(p_airport_pickup,false),nullif(clean_flight,''),
   case when p_airport_pickup and clean_flight<>'' then 'tracking_requested' else 'not_requested' end,
   coalesce(p_service_options,'{}'::text[]),p_business_account_id,
   nullif(left(trim(coalesce(p_company_reference,'')),80),''),p_fare_model,p_platform_funded_discount,
   p_estimated_distance_km,p_estimated_duration_minutes
 ) returning * into r;
 return r;
end;
$function$;

revoke all on function public.create_customer_ride(
  text,double precision,double precision,text,double precision,double precision,
  text,text,numeric,text,timestamptz,text,text,text,numeric,numeric,numeric,numeric,
  boolean,text,text[],uuid,text,text,numeric,numeric,integer
) from public, anon;
grant execute on function public.create_customer_ride(
  text,double precision,double precision,text,double precision,double precision,
  text,text,numeric,text,timestamptz,text,text,text,numeric,numeric,numeric,numeric,
  boolean,text,text[],uuid,text,text,numeric,numeric,integer
) to authenticated;

create table if not exists public.driver_activity_guarantees (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  ride_count integer not null default 0 check (ride_count >= 0),
  review_ride_count integer not null default 0 check (review_ride_count >= 0),
  activity_seconds numeric not null default 0 check (activity_seconds >= 0),
  qualifying_income numeric not null default 0 check (qualifying_income >= 0),
  required_income numeric not null default 0 check (required_income >= 0),
  top_up_amount numeric not null default 0 check (top_up_amount >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'pending'
    check (status in ('not_due','pending','needs_review','processing','paid','failed')),
  stripe_transfer_id text,
  failure_reason text,
  calculated_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, period_start, period_end),
  check (period_end > period_start)
);

create index if not exists driver_activity_guarantees_driver_period_idx
  on public.driver_activity_guarantees (driver_id, period_start desc);
create index if not exists driver_activity_guarantees_due_idx
  on public.driver_activity_guarantees (status, period_end)
  where status in ('pending','needs_review','failed');

alter table public.driver_activity_guarantees enable row level security;
revoke all on table public.driver_activity_guarantees from public, anon, authenticated;
grant select on table public.driver_activity_guarantees to authenticated;

drop policy if exists driver_reads_own_activity_guarantees on public.driver_activity_guarantees;
create policy driver_reads_own_activity_guarantees
on public.driver_activity_guarantees for select to authenticated
using (exists (
  select 1 from public.drivers d
  where d.id = driver_activity_guarantees.driver_id and d.user_id = auth.uid()
));

create or replace function public.vasi_reconcile_driver_activity_guarantees(
  p_period_start date,
  p_period_end date,
  p_driver_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare affected integer := 0;
begin
  if p_period_end <= p_period_start or p_period_end > p_period_start + interval '1 month 1 day' then
    raise exception 'Invalid guarantee period';
  end if;

  with ride_activity as (
    select
      r.driver_id,
      count(*)::integer as ride_count,
      count(*) filter (where
        r.completed_at is null or
        (r.mode::text = 'reserve' and r.started_at is null) or
        (r.mode::text <> 'reserve' and r.accepted_at is null)
      )::integer as review_ride_count,
      coalesce(sum(case
        when r.mode::text = 'reserve' and r.started_at is not null and r.completed_at is not null then
          extract(epoch from (r.completed_at-r.started_at))
          + least(extract(epoch from (r.completed_at-r.started_at))*0.15, 300)
        when r.mode::text <> 'reserve' and r.accepted_at is not null and r.completed_at is not null then
          extract(epoch from (r.completed_at-r.accepted_at))
        else 0
      end),0) as activity_seconds,
      round(coalesce(sum(r.driver_amount),0),2) as qualifying_income
    from public.rides r
    where r.status::text='completed'
      and r.completed_at >= p_period_start::timestamptz
      and r.completed_at < p_period_end::timestamptz
      and r.driver_id is not null
      and (p_driver_id is null or r.driver_id=p_driver_id)
    group by r.driver_id
  ), calculated as (
    select *,
      round(activity_seconds / 3600 * 30, 2) as required_income,
      greatest(round(activity_seconds / 3600 * 30, 2)-qualifying_income,0) as top_up_amount
    from ride_activity
  )
  insert into public.driver_activity_guarantees(
    driver_id,period_start,period_end,ride_count,review_ride_count,activity_seconds,
    qualifying_income,required_income,top_up_amount,status,calculated_at,updated_at
  )
  select driver_id,p_period_start,p_period_end,ride_count,review_ride_count,activity_seconds,
    qualifying_income,required_income,top_up_amount,
    case when review_ride_count>0 then 'needs_review'
         when top_up_amount>0 then 'pending' else 'not_due' end,
    now(),now()
  from calculated
  on conflict (driver_id,period_start,period_end) do update set
    ride_count=excluded.ride_count,
    review_ride_count=excluded.review_ride_count,
    activity_seconds=excluded.activity_seconds,
    qualifying_income=excluded.qualifying_income,
    required_income=excluded.required_income,
    top_up_amount=excluded.top_up_amount,
    status=case
      when driver_activity_guarantees.status in ('paid','processing')
        then driver_activity_guarantees.status
      else excluded.status end,
    calculated_at=now(),updated_at=now();
  get diagnostics affected = row_count;
  return affected;
end;
$function$;

revoke all on function public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)
  from public, anon, authenticated;
grant execute on function public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)
  to service_role;

create or replace function public.vasi_reconcile_previous_month_driver_guarantees()
returns integer
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select public.vasi_reconcile_driver_activity_guarantees(
    (date_trunc('month', now())-interval '1 month')::date,
    date_trunc('month', now())::date,
    null
  );
$function$;

revoke all on function public.vasi_reconcile_previous_month_driver_guarantees()
  from public, anon, authenticated;
grant execute on function public.vasi_reconcile_previous_month_driver_guarantees()
  to service_role;

do $block$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='vasi-monthly-driver-guarantee';
    perform cron.schedule(
      'vasi-monthly-driver-guarantee',
      '15 4 1 * *',
      'select public.vasi_reconcile_previous_month_driver_guarantees();'
    );
  end if;
exception when others then
  raise notice 'Monthly driver guarantee cron must be configured separately: %', sqlerrm;
end;
$block$;

comment on column public.rides.platform_funded_discount is
  'Customer discount funded solely from VASI gross commission; it never reduces driver_amount.';
comment on table public.driver_activity_guarantees is
  'Calendar-period reconciliation of the French EUR 30 per activity-hour driver income guarantee.';
