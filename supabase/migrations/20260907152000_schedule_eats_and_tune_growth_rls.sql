-- Enable the hosted scheduler for paid Eats orders and keep growth-feature
-- policies single-purpose so Postgres evaluates only the required action.

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'release-vasi-scheduled-eats';

select cron.schedule(
  'release-vasi-scheduled-eats',
  '* * * * *',
  'select public.release_scheduled_eats_orders();'
);

drop policy if exists business_members_owner_write on public.business_members;
create policy business_members_owner_insert on public.business_members
for insert to authenticated with check (
  (select private.is_business_member(business_id,array['owner','admin'])) or
  business_id in (select id from public.business_accounts where owner_id=(select auth.uid()))
);
create policy business_members_owner_update on public.business_members
for update to authenticated using (
  (select private.is_business_member(business_id,array['owner','admin']))
) with check (
  (select private.is_business_member(business_id,array['owner','admin']))
);
create policy business_members_owner_delete on public.business_members
for delete to authenticated using (
  (select private.is_business_member(business_id,array['owner','admin'])) and user_id<>(select auth.uid())
);

drop policy if exists group_orders_host_write on public.eats_group_orders;
create policy group_orders_host_insert on public.eats_group_orders
for insert to authenticated with check (host_user_id=(select auth.uid()));
create policy group_orders_host_update on public.eats_group_orders
for update to authenticated using (host_user_id=(select auth.uid()))
with check (host_user_id=(select auth.uid()));
create policy group_orders_host_delete on public.eats_group_orders
for delete to authenticated using (host_user_id=(select auth.uid()));

drop policy if exists group_members_own_write on public.eats_group_order_members;
create policy group_members_own_insert on public.eats_group_order_members
for insert to authenticated with check (user_id=(select auth.uid()));
create policy group_members_own_update on public.eats_group_order_members
for update to authenticated using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create policy group_members_own_delete on public.eats_group_order_members
for delete to authenticated using (user_id=(select auth.uid()));

revoke execute on function public.vasi_create_business_account(text,text,text,text) from public, anon;
revoke execute on function public.vasi_generate_business_invoice(uuid,date) from public, anon;
revoke execute on function public.vasi_driver_set_capabilities(text[]) from public, anon;
revoke execute on function public.create_customer_ride(text,double precision,double precision,text,double precision,double precision,text,text,numeric,text,timestamptz,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text[],uuid,text) from public, anon;
