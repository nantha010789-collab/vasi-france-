set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Optional private Storage path for the customer profile photo.';

drop trigger if exists vasi_touch_profile_updated_at on public.profiles;

create trigger vasi_touch_profile_updated_at
before update of full_name, country_code, currency, avatar_path
on public.profiles
for each row
execute function private.vasi_touch_profile_updated_at();

revoke update (avatar_path)
  on table public.profiles
  from public, anon;

grant update (avatar_path)
  on table public.profiles
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'customer-avatars',
  'customer-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customers read own avatar" on storage.objects;
drop policy if exists "customers upload own avatar" on storage.objects;
drop policy if exists "customers update own avatar" on storage.objects;
drop policy if exists "customers delete own avatar" on storage.objects;

create policy "customers read own avatar"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "customers upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "customers update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'customer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'customer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "customers delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

