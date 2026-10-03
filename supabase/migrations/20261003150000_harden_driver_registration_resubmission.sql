-- Keep driver approval state server-controlled while still allowing applicants
-- to create a profile and resubmit pending or rejected documents.

drop policy if exists "driver own insert" on public.drivers;
create policy "driver own insert"
on public.drivers
for insert
to authenticated
with check (
  auth.uid() = id
  and user_id = auth.uid()
  and role = 'ride'
  and status = 'pending'
  and verified = false
  and online = false
  and stripe_account_id is null
  and stripe_details_submitted = false
  and stripe_payouts_enabled = false
);

revoke insert, update on public.drivers from authenticated;
grant insert (id, user_id, full_name, phone) on public.drivers to authenticated;
grant update (
  full_name,
  phone,
  latitude,
  longitude,
  online,
  vehicle_make,
  vehicle_model,
  vehicle_plate,
  vehicle_color,
  vehicle_type,
  service_capabilities,
  updated_at
) on public.drivers to authenticated;

drop policy if exists "courier can create own profile" on public.delivery_drivers;
create policy "courier can create own profile"
on public.delivery_drivers
for insert
to authenticated
with check (
  user_id = auth.uid()
  and application_status = 'pending'
  and rejection_reason is null
  and reviewed_at is null
  and reviewed_by is null
  and verified = false
  and online = false
  and stripe_account_id is null
  and stripe_details_submitted = false
  and stripe_payouts_enabled = false
);

drop policy if exists "drivers_submit_own_documents" on public.driver_documents;
create policy "drivers_submit_own_documents"
on public.driver_documents
for insert
to authenticated
with check (
  driver_id = auth.uid()
  and file_path like auth.uid()::text || '/%'
  and document_type = any (array[
    'identity', 'profile_photo', 'vtc', 'licence', 'business',
    'insurance', 'carte_grise', 'vehicle_licence', 'selfie'
  ])
  and exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and account_role = 'ride'
  )
);

drop policy if exists "drivers_resubmit_own_documents" on public.driver_documents;
create policy "drivers_resubmit_own_documents"
on public.driver_documents
for update
to authenticated
using (
  driver_id = auth.uid()
  and status in ('pending', 'rejected')
  and exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and account_role = 'ride'
  )
)
with check (
  driver_id = auth.uid()
  and file_path like auth.uid()::text || '/%'
  and status = 'pending'
  and rejection_reason is null
  and document_type = any (array[
    'identity', 'profile_photo', 'vtc', 'licence', 'business',
    'insurance', 'carte_grise', 'vehicle_licence', 'selfie'
  ])
);

grant update (file_path, status, rejection_reason, updated_at)
on public.driver_documents to authenticated;

create or replace function public.vasi_resubmit_driver_application()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and account_role = 'ride'
  ) then
    raise exception 'Ride account required';
  end if;

  update public.drivers
  set status = 'pending', rejection_reason = null, reviewed_at = null,
      reviewed_by = null, verified = false, online = false, updated_at = now()
  where id = auth.uid() and status = 'rejected';
end;
$$;

create or replace function public.vasi_resubmit_courier_application()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and account_role = 'courier'
  ) then
    raise exception 'Courier account required';
  end if;

  update public.delivery_drivers
  set application_status = 'pending', rejection_reason = null,
      reviewed_at = null, reviewed_by = null, verified = false,
      online = false, updated_at = now()
  where user_id = auth.uid() and application_status = 'rejected';
end;
$$;

revoke all on function public.vasi_resubmit_driver_application() from public, anon;
revoke all on function public.vasi_resubmit_courier_application() from public, anon;
grant execute on function public.vasi_resubmit_driver_application() to authenticated;
grant execute on function public.vasi_resubmit_courier_application() to authenticated;
