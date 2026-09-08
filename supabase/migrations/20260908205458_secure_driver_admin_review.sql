revoke all on table public.driver_documents from authenticated;

grant select (document_type, status, rejection_reason, expires_at, created_at, updated_at)
  on table public.driver_documents to authenticated;

grant insert (driver_id, document_type, file_path)
  on table public.driver_documents to authenticated;

drop policy if exists drivers_submit_own_documents on public.driver_documents;

create policy drivers_submit_own_documents
  on public.driver_documents
  for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and file_path like (select auth.uid())::text || '/%'
    and document_type in (
      'identity', 'vtc', 'licence', 'business', 'insurance',
      'carte_grise', 'vehicle_licence', 'selfie'
    )
    and exists (
      select 1
      from public.account_roles
      where account_roles.user_id = (select auth.uid())
        and account_roles.account_role = 'ride'
    )
  );
