-- VASI European Mobility Platform growth features.
-- Adds assisted/airport rides, safer reassignment, driver tools,
-- scheduled/group Eats orders and company ride statements.

alter table public.drivers
  add column if not exists service_capabilities text[] not null default '{}'::text[];

alter table public.rides
  add column if not exists airport_pickup boolean not null default false,
  add column if not exists flight_number text,
  add column if not exists flight_status text not null default 'not_requested',
  add column if not exists flight_status_checked_at timestamptz,
  add column if not exists service_options text[] not null default '{}'::text[],
  add column if not exists reassignment_count integer not null default 0,
  add column if not exists last_driver_cancelled_at timestamptz,
  add column if not exists company_reference text;

do $$ begin
  alter table public.rides add constraint rides_flight_number_format
    check (flight_number is null or flight_number ~ '^[A-Z0-9]{2,3}[ -]?[0-9]{1,4}[A-Z]?$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rides add constraint rides_service_options_allowed
    check (service_options <@ array['wheelchair_accessible','child_seat','pet_friendly']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.drivers add constraint drivers_service_capabilities_allowed
    check (service_capabilities <@ array['wheelchair_accessible','child_seat','pet_friendly']::text[]);
exception when duplicate_object then null; end $$;

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  billing_email text not null check (char_length(billing_email) between 5 and 254),
  registration_number text check (registration_number is null or char_length(registration_number) <= 40),
  billing_address text check (billing_address is null or char_length(billing_address) <= 300),
  country_code text not null default 'FR' check (country_code ~ '^[A-Z]{2}$'),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.business_monthly_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  invoice_month date not null,
  invoice_number text not null unique,
  ride_count integer not null default 0 check (ride_count >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  currency text not null default 'EUR',
  status text not null default 'statement' check (status in ('statement','issued','paid','void')),
  generated_by uuid not null references auth.users(id),
  generated_at timestamptz not null default now(),
  unique (business_id, invoice_month)
);

alter table public.rides add column if not exists business_account_id uuid
  references public.business_accounts(id) on delete set null;

create table if not exists public.eats_group_orders (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  invite_token uuid not null default gen_random_uuid() unique,
  status text not null default 'open' check (status in ('open','closed','ordered','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eats_group_order_members (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.eats_group_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now(),
  unique (group_order_id, user_id)
);

alter table public.eats_orders
  add column if not exists scheduled_for timestamptz,
  add column if not exists unavailable_item_preference text not null default 'refund',
  add column if not exists group_order_id uuid references public.eats_group_orders(id) on delete set null;

do $$ begin
  alter table public.eats_orders add constraint eats_unavailable_item_preference_allowed
    check (unavailable_item_preference in ('refund','replace_similar','contact_me'));
exception when duplicate_object then null; end $$;

create index if not exists rides_business_month_idx
  on public.rides (business_account_id, completed_at)
  where business_account_id is not null and status = 'completed';
create index if not exists rides_pending_heatmap_idx
  on public.rides (status, requested_at)
  where status = 'requested';
create index if not exists driver_documents_expiry_idx
  on public.driver_documents (driver_id, expires_at)
  where expires_at is not null;
create index if not exists eats_orders_schedule_idx
  on public.eats_orders (scheduled_for)
  where status = 'scheduled' and payment_status = 'paid';
create index if not exists business_members_user_idx
  on public.business_members (user_id, active);
create index if not exists eats_group_members_group_idx
  on public.eats_group_order_members (group_order_id, updated_at);

alter table public.business_accounts enable row level security;
alter table public.business_members enable row level security;
alter table public.business_monthly_invoices enable row level security;
alter table public.eats_group_orders enable row level security;
alter table public.eats_group_order_members enable row level security;

revoke all on public.business_accounts, public.business_members,
  public.business_monthly_invoices, public.eats_group_orders,
  public.eats_group_order_members from anon;
grant select, insert, update on public.business_accounts to authenticated;
grant select, insert, update on public.business_members to authenticated;
grant select, insert on public.business_monthly_invoices to authenticated;
grant select, insert, update on public.eats_group_orders to authenticated;
grant select, insert, update on public.eats_group_order_members to authenticated;

create schema if not exists private;
create or replace function private.is_business_member(p_business_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.business_members m where m.business_id=p_business_id and m.user_id=auth.uid() and m.active and (p_roles is null or m.role=any(p_roles))) $$;
create or replace function private.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.eats_group_order_members m where m.group_order_id=p_group_id and m.user_id=auth.uid()) $$;
create or replace function private.is_group_host(p_group_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.eats_group_orders g where g.id=p_group_id and g.host_user_id=auth.uid()) $$;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid,text[]), private.is_group_member(uuid), private.is_group_host(uuid) to authenticated;

drop policy if exists business_accounts_member_read on public.business_accounts;
create policy business_accounts_member_read on public.business_accounts
for select to authenticated using (
  owner_id = (select auth.uid()) or (select private.is_business_member(id))
);
drop policy if exists business_accounts_owner_insert on public.business_accounts;
create policy business_accounts_owner_insert on public.business_accounts
for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists business_accounts_owner_update on public.business_accounts;
create policy business_accounts_owner_update on public.business_accounts
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists business_members_member_read on public.business_members;
create policy business_members_member_read on public.business_members
for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_business_member(business_id,array['owner','admin']))
);
drop policy if exists business_members_owner_write on public.business_members;
create policy business_members_owner_write on public.business_members
for all to authenticated using (
  (select private.is_business_member(business_id,array['owner','admin'])) or
  business_id in (select id from public.business_accounts where owner_id=(select auth.uid()))
) with check (
  (select private.is_business_member(business_id,array['owner','admin'])) or
  business_id in (select id from public.business_accounts where owner_id=(select auth.uid()))
);

drop policy if exists business_invoices_member_read on public.business_monthly_invoices;
create policy business_invoices_member_read on public.business_monthly_invoices
for select to authenticated using (
  (select private.is_business_member(business_id))
);
drop policy if exists business_invoices_admin_insert on public.business_monthly_invoices;
create policy business_invoices_admin_insert on public.business_monthly_invoices
for insert to authenticated with check (
  generated_by = (select auth.uid()) and (select private.is_business_member(business_id,array['owner','admin']))
);

drop policy if exists group_orders_member_read on public.eats_group_orders;
create policy group_orders_member_read on public.eats_group_orders
for select to authenticated using (
  host_user_id = (select auth.uid()) or (select private.is_group_member(id))
);
drop policy if exists group_orders_host_write on public.eats_group_orders;
create policy group_orders_host_write on public.eats_group_orders
for all to authenticated using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));
drop policy if exists group_members_read on public.eats_group_order_members;
create policy group_members_read on public.eats_group_order_members
for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_group_host(group_order_id))
);
drop policy if exists group_members_own_write on public.eats_group_order_members;
create policy group_members_own_write on public.eats_group_order_members
for all to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists drivers_read_own_documents on public.driver_documents;
create policy drivers_read_own_documents on public.driver_documents
for select to authenticated using (
  driver_id in (select id from public.drivers where user_id = (select auth.uid()))
);
drop policy if exists drivers_read_own_earnings on public.driver_earnings;
create policy drivers_read_own_earnings on public.driver_earnings
for select to authenticated using (
  driver_id in (select id from public.drivers where user_id = (select auth.uid()))
);

create or replace function public.vasi_create_business_account(
  p_legal_name text, p_billing_email text, p_registration_number text default null,
  p_billing_address text default null
) returns public.business_accounts
language plpgsql security invoker set search_path = 'public'
as $$ declare b public.business_accounts; begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  insert into public.business_accounts(owner_id, legal_name, billing_email, registration_number, billing_address)
  values(auth.uid(), trim(p_legal_name), lower(trim(p_billing_email)), nullif(trim(p_registration_number),''), nullif(trim(p_billing_address),''))
  returning * into b;
  insert into public.business_members(business_id,user_id,role) values(b.id,auth.uid(),'owner');
  return b;
end $$;
grant execute on function public.vasi_create_business_account(text,text,text,text) to authenticated;

create or replace function public.vasi_generate_business_invoice(p_business_id uuid, p_month date)
returns public.business_monthly_invoices
language plpgsql security invoker set search_path = 'public'
as $$ declare inv public.business_monthly_invoices; n integer; amount numeric(12,2); currency_code text; month_start date; begin
  if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and active and role in ('owner','admin')) then
    raise exception 'Business administrator access required';
  end if;
  month_start := date_trunc('month', p_month)::date;
  select count(*), coalesce(sum(coalesce(final_fare,estimated_fare,0)),0), coalesce(max(currency),'EUR')
    into n, amount, currency_code from public.rides
    where business_account_id=p_business_id and status='completed'
      and completed_at >= month_start and completed_at < month_start + interval '1 month';
  insert into public.business_monthly_invoices(business_id,invoice_month,invoice_number,ride_count,subtotal,tax_amount,total,currency,status,generated_by)
  values(p_business_id,month_start,'VASI-FR-'||to_char(month_start,'YYYYMM')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),n,amount,0,amount,currency_code,'statement',auth.uid())
  on conflict (business_id,invoice_month) do update set ride_count=excluded.ride_count,subtotal=excluded.subtotal,total=excluded.total,generated_by=excluded.generated_by,generated_at=now()
  returning * into inv;
  return inv;
end $$;
grant execute on function public.vasi_generate_business_invoice(uuid,date) to authenticated;

create or replace function public.vasi_driver_set_capabilities(p_capabilities text[])
returns text[] language plpgsql security invoker set search_path='public'
as $$ declare cleaned text[]; begin
  select coalesce(array_agg(distinct x),'{}'::text[]) into cleaned
    from unnest(coalesce(p_capabilities,'{}'::text[])) x
    where x in ('wheelchair_accessible','child_seat','pet_friendly');
  update public.drivers set service_capabilities=cleaned,updated_at=now()
    where user_id=auth.uid() and verified=true;
  if not found then raise exception 'Verified ride driver profile required'; end if;
  return cleaned;
end $$;
grant execute on function public.vasi_driver_set_capabilities(text[]) to authenticated;

create or replace function public.vasi_driver_demand_heatmap()
returns table(area_lat double precision, area_lng double precision, requests bigint)
language plpgsql security definer set search_path='pg_catalog','public'
as $$ begin
  if not exists(select 1 from public.drivers where user_id=auth.uid() and verified=true and coalesce(role,'ride') in ('ride','driver','ride_driver')) then
    raise exception 'Verified ride driver profile required';
  end if;
  return query select round(r.pickup_lat::numeric,2)::double precision,
    round(r.pickup_lng::numeric,2)::double precision,count(*)
    from public.rides r where r.status='requested' and r.pickup_lat is not null and r.pickup_lng is not null
      and coalesce(r.scheduled_for,now()) <= now()+interval '2 hours'
      and r.requested_at >= now()-interval '2 hours'
    group by 1,2 order by 3 desc limit 12;
end $$;
revoke all on function public.vasi_driver_demand_heatmap() from public,anon;
grant execute on function public.vasi_driver_demand_heatmap() to authenticated;

create or replace function public.vasi_driver_cancel_and_reassign(p_ride_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public'
as $$ declare did uuid; r public.rides; offered integer:=0; begin
  select id into did from public.drivers where user_id=auth.uid() and verified=true and coalesce(role,'ride') in ('ride','driver','ride_driver') limit 1;
  if did is null then raise exception 'Verified ride driver profile required'; end if;
  select * into r from public.rides where id=p_ride_id and driver_id=did for update;
  if r.id is null then raise exception 'Ride not assigned to this driver'; end if;
  if r.status::text not in ('accepted','driver_arriving') then raise exception 'This ride can no longer be reassigned'; end if;
  update public.vasi_dispatch_offers set status='declined',responded_at=coalesce(responded_at,now())
    where job_id=r.id and service='ride' and driver_id=did;
  update public.rides set driver_id=null,status='requested',accepted_at=null,arrived_at=null,
    reassignment_count=reassignment_count+1,last_driver_cancelled_at=now(),
    notes=case when nullif(trim(p_reason),'') is null then notes else concat_ws(E'\n',notes,'Driver reassignment: '||left(trim(p_reason),180)) end
    where id=r.id returning * into r;
  insert into public.vasi_dispatch_offers(service,job_id,driver_id,status,offered_at,expires_at)
  select 'ride',r.id,d.id,'pending',now(),now()+interval '30 seconds' from public.drivers d
    where d.verified and d.online and d.id<>did and d.latitude is not null and d.longitude is not null
      and coalesce(d.role,'ride') in ('ride','driver','ride_driver')
      and r.service_options <@ d.service_capabilities
    order by ((d.latitude-r.pickup_lat)^2+(d.longitude-r.pickup_lng)^2) limit 5
  on conflict(job_id,driver_id) do update set status='pending',offered_at=now(),expires_at=now()+interval '30 seconds',responded_at=null;
  get diagnostics offered=row_count;
  return jsonb_build_object('ok',true,'ride_id',r.id,'status','requested','offers_sent',offered,'reassignment_count',r.reassignment_count);
end $$;
revoke all on function public.vasi_driver_cancel_and_reassign(uuid,text) from public,anon;
grant execute on function public.vasi_driver_cancel_and_reassign(uuid,text) to authenticated;

create or replace function public.vasi_dispatch_ride(p_ride_id uuid)
returns integer language plpgsql security definer set search_path='public'
as $$ declare r public.rides; n integer:=0; begin
 select * into r from public.rides where id=p_ride_id and customer_id=auth.uid() and status='requested' and driver_id is null for update;
 if r.id is null then return 0; end if;
 update public.vasi_dispatch_offers set status='expired',responded_at=coalesce(responded_at,now()) where job_id=r.id and service='ride' and status='pending' and expires_at<=now();
 if exists(select 1 from public.vasi_dispatch_offers where job_id=r.id and service='ride' and status='pending' and expires_at>now()) then return 0; end if;
 insert into public.vasi_dispatch_offers(service,job_id,driver_id,status,offered_at,expires_at)
 select 'ride',r.id,d.id,'pending',now(),now()+interval '30 seconds' from public.drivers d
 where d.verified=true and d.online=true and d.latitude is not null and d.longitude is not null and coalesce(d.role,'ride') in ('ride','driver','ride_driver')
   and r.service_options <@ d.service_capabilities
 order by ((d.latitude-r.pickup_lat)^2 + (d.longitude-r.pickup_lng)^2) asc limit 5
 on conflict(job_id,driver_id) do update set status='pending',offered_at=now(),expires_at=now()+interval '30 seconds',responded_at=null;
 get diagnostics n=row_count; return n;
end $$;

create or replace function public.create_customer_ride(
 p_pickup_address text,p_pickup_lat double precision,p_pickup_lng double precision,p_destination_address text,
 p_destination_lat double precision default null,p_destination_lng double precision default null,p_service text default 'VASI Go',
 p_payment_method text default 'cash',p_estimated_fare numeric default 0,p_currency text default 'EUR',p_scheduled_for timestamptz default null,
 p_passenger_name text default null,p_passenger_phone text default null,p_notes text default null,p_regular_fare numeric default 0,
 p_customer_discount numeric default 0,p_driver_amount numeric default 0,p_vasi_commission numeric default 0,
 p_airport_pickup boolean default false,p_flight_number text default null,p_service_options text[] default '{}'::text[],
 p_business_account_id uuid default null,p_company_reference text default null
) returns public.rides language plpgsql set search_path='public'
as $$ declare r public.rides; ride_mode text:='ride'; clean_flight text; begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 if p_estimated_fare<0 or p_regular_fare<p_estimated_fare or p_customer_discount<0 or p_driver_amount<0 or p_vasi_commission<0 then raise exception 'Invalid fare breakdown'; end if;
 if abs((p_regular_fare-p_customer_discount)-p_estimated_fare)>0.02 then raise exception 'Fare breakdown mismatch'; end if;
 if p_driver_amount>p_regular_fare then raise exception 'Invalid driver amount'; end if;
 if p_scheduled_for is not null then
   if p_scheduled_for<now()+interval '30 minutes' then raise exception 'Scheduled pickup must be at least 30 minutes from now'; end if;
   if p_scheduled_for>now()+interval '90 days' then raise exception 'Scheduled pickup must be within 90 days'; end if;
   ride_mode:='reserve';
 end if;
 if not coalesce(p_service_options,'{}'::text[]) <@ array['wheelchair_accessible','child_seat','pet_friendly']::text[] then raise exception 'Unsupported ride option'; end if;
 clean_flight:=upper(replace(trim(coalesce(p_flight_number,'')),' ',''));
 if p_airport_pickup and clean_flight<>'' and clean_flight !~ '^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$' then raise exception 'Enter a valid flight number'; end if;
 if p_business_account_id is not null and not exists(select 1 from public.business_members where business_id=p_business_account_id and user_id=auth.uid() and active) then raise exception 'Business account access required'; end if;
 insert into public.rides(customer_id,pickup_address,pickup_lat,pickup_lng,destination_address,destination_lat,destination_lng,currency,estimated_fare,regular_fare,customer_discount,driver_amount,vasi_commission,status,requested_at,mode,service,payment_method,scheduled_for,passenger_name,passenger_phone,notes,airport_pickup,flight_number,flight_status,service_options,business_account_id,company_reference)
 values(auth.uid(),p_pickup_address,p_pickup_lat,p_pickup_lng,p_destination_address,p_destination_lat,p_destination_lng,p_currency,p_estimated_fare,p_regular_fare,p_customer_discount,p_driver_amount,p_vasi_commission,'requested',now(),ride_mode,p_service,p_payment_method,p_scheduled_for,p_passenger_name,p_passenger_phone,p_notes,coalesce(p_airport_pickup,false),nullif(clean_flight,''),case when p_airport_pickup and clean_flight<>'' then 'tracking_requested' else 'not_requested' end,coalesce(p_service_options,'{}'::text[]),p_business_account_id,nullif(left(trim(coalesce(p_company_reference,'')),80),''))
 returning * into r; return r;
end $$;
grant execute on function public.create_customer_ride(text,double precision,double precision,text,double precision,double precision,text,text,numeric,text,timestamptz,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text[],uuid,text) to authenticated;

create or replace function public.release_scheduled_eats_orders()
returns integer language plpgsql security definer set search_path='pg_catalog','public'
as $$ declare n integer; begin
  update public.eats_orders set status='pending'
  where status='scheduled' and payment_status='paid' and scheduled_for<=now()+interval '20 minutes';
  get diagnostics n=row_count; return n;
end $$;
revoke all on function public.release_scheduled_eats_orders() from public,anon,authenticated;
grant execute on function public.release_scheduled_eats_orders() to service_role;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='release-vasi-scheduled-eats';
    perform cron.schedule('release-vasi-scheduled-eats','* * * * *','select public.release_scheduled_eats_orders();');
  end if;
exception when others then raise notice 'Scheduled Eats cron will be configured separately: %',sqlerrm; end $$;

comment on column public.rides.flight_status is 'Provider-neutral flight tracking status; live updates require the configured aviation data provider.';
comment on table public.business_monthly_invoices is 'Consolidated company ride statements. Tax remains zero until VASI tax registration and invoicing configuration are active.';
