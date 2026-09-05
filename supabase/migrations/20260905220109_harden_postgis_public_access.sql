-- PostGIS is non-relocatable in this project, so keep the extension in public
-- while removing its metadata table and statistics helpers from the Data API.
-- This migration must be applied by the owner of public.spatial_ref_sys
-- (normally supabase_admin in hosted Supabase).

alter table public.spatial_ref_sys enable row level security;

revoke all privileges on table public.spatial_ref_sys
  from public, anon, authenticated;

drop policy if exists "deny client access to spatial reference metadata"
  on public.spatial_ref_sys;

create policy "deny client access to spatial reference metadata"
on public.spatial_ref_sys
for select
to anon, authenticated
using (false);

revoke execute on function public.st_estimatedextent(text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean)
  from public, anon, authenticated;
