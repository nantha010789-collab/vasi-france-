drop policy if exists "driver own insert" on public.drivers;
create policy "driver own insert" on public.drivers
for insert to authenticated
with check (
  (select auth.uid()) = id
  and user_id = (select auth.uid())
  and role = 'ride'::text
  and status = 'pending'::text
  and verified = false
  and online = false
  and stripe_account_id is null
  and stripe_details_submitted = false
  and stripe_payouts_enabled = false
);

drop policy if exists "courier can create own profile" on public.delivery_drivers;
create policy "courier can create own profile" on public.delivery_drivers
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and application_status = 'pending'::text
  and rejection_reason is null
  and reviewed_at is null
  and reviewed_by is null
  and verified = false
  and online = false
  and stripe_account_id is null
  and stripe_details_submitted = false
  and stripe_payouts_enabled = false
);
