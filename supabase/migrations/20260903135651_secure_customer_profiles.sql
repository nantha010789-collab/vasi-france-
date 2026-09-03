set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep trusted Auth data and internal trigger functions outside the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.vasi_sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  verified_phone text;
begin
  verified_phone :=
    case
      when new.phone_confirmed_at is not null
        then nullif(btrim(new.phone), '')
      else null
    end;

  insert into public.profiles as profile (id, phone)
  values (new.id, verified_phone)
  on conflict (id) do update
    set phone = excluded.phone,
        updated_at = now()
    where profile.phone is distinct from excluded.phone;

  return new;
end;
$function$;

revoke all
  on function private.vasi_sync_auth_user_profile()
  from public, anon, authenticated;

-- Replace duplicate profile-creation triggers while preserving the separate
-- VASI admin allowlist trigger.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists vasi_sync_auth_user_profile on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.handle_new_user_profile();

create trigger vasi_sync_auth_user_profile
after insert or update of phone, phone_confirmed_at
on auth.users
for each row
execute function private.vasi_sync_auth_user_profile();

-- Guarantee one profile for every Auth user and copy only confirmed phones.
insert into public.profiles as profile (id, phone)
select
  auth_user.id,
  case
    when auth_user.phone_confirmed_at is not null
      then nullif(btrim(auth_user.phone), '')
    else null
  end
from auth.users as auth_user
on conflict (id) do update
  set phone = excluded.phone,
      updated_at = now()
  where profile.phone is distinct from excluded.phone;

create or replace function private.vasi_touch_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all
  on function private.vasi_touch_profile_updated_at()
  from public, anon, authenticated;

drop trigger if exists vasi_touch_profile_updated_at on public.profiles;

create trigger vasi_touch_profile_updated_at
before update of full_name, country_code, currency
on public.profiles
for each row
execute function private.vasi_touch_profile_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Customers can read their row and edit display preferences only. Role and
-- phone remain server-managed because admin authorization trusts role and the
-- verified phone comes from Supabase Auth.
revoke all privileges
  on table public.profiles
  from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (full_name, country_code, currency)
  on table public.profiles
  to authenticated;
grant select, insert, update, delete
  on table public.profiles
  to service_role;

do $block$
begin
  if exists (
    select 1
    from auth.users auth_user
    left join public.profiles profile on profile.id = auth_user.id
    where profile.id is null
  ) then
    raise exception 'Profile backfill left auth users without profiles';
  end if;

  if exists (
    select 1
    from auth.users auth_user
    join public.profiles profile on profile.id = auth_user.id
    where profile.phone is distinct from
      case
        when auth_user.phone_confirmed_at is not null
          then nullif(btrim(auth_user.phone), '')
        else null
      end
  ) then
    raise exception 'Profile phone backfill does not match confirmed Auth phones';
  end if;

  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE')
  then
    raise exception 'Trusted profile columns are writable by authenticated users';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.profiles',
    'full_name',
    'UPDATE'
  ) then
    raise exception 'Editable profile columns are not writable';
  end if;
end;
$block$;
