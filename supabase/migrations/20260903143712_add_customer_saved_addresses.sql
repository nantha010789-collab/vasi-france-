set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.customer_saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  label text not null
    check (label in ('Home', 'Work', 'Other')),
  address_line text not null
    check (char_length(btrim(address_line)) between 3 and 180),
  postal_code text not null
    check (char_length(btrim(postal_code)) between 2 and 16),
  city text not null
    check (char_length(btrim(city)) between 1 and 80),
  country_code text not null default 'FR'
    check (country_code in ('FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'GB', 'CH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_saved_addresses_user_label_key
  on public.customer_saved_addresses (user_id, label);

create index customer_saved_addresses_user_created_idx
  on public.customer_saved_addresses (user_id, created_at);

create or replace function private.vasi_touch_saved_address_updated_at()
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
  on function private.vasi_touch_saved_address_updated_at()
  from public, anon, authenticated;

create trigger vasi_touch_saved_address_updated_at
before update of label, address_line, postal_code, city, country_code
on public.customer_saved_addresses
for each row
execute function private.vasi_touch_saved_address_updated_at();

alter table public.customer_saved_addresses enable row level security;

create policy customer_saved_addresses_select_own
on public.customer_saved_addresses
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

create policy customer_saved_addresses_insert_own
on public.customer_saved_addresses
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

create policy customer_saved_addresses_update_own
on public.customer_saved_addresses
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

create policy customer_saved_addresses_delete_own
on public.customer_saved_addresses
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

revoke all privileges
  on table public.customer_saved_addresses
  from public, anon, authenticated;

grant select, delete
  on table public.customer_saved_addresses
  to authenticated;

grant insert (label, address_line, postal_code, city, country_code)
  on table public.customer_saved_addresses
  to authenticated;

grant update (label, address_line, postal_code, city, country_code)
  on table public.customer_saved_addresses
  to authenticated;

grant select, insert, update, delete
  on table public.customer_saved_addresses
  to service_role;

do $block$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.customer_saved_addresses'::regclass
  ) then
    raise exception 'RLS is not enabled on customer_saved_addresses';
  end if;

  if has_table_privilege('anon', 'public.customer_saved_addresses', 'SELECT')
    or has_table_privilege('anon', 'public.customer_saved_addresses', 'INSERT')
    or has_table_privilege('anon', 'public.customer_saved_addresses', 'UPDATE')
    or has_table_privilege('anon', 'public.customer_saved_addresses', 'DELETE')
  then
    raise exception 'Anonymous users can access customer saved addresses';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.customer_saved_addresses',
    'user_id',
    'INSERT'
  ) or has_column_privilege(
    'authenticated',
    'public.customer_saved_addresses',
    'user_id',
    'UPDATE'
  ) then
    raise exception 'Authenticated users can write saved address ownership';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.customer_saved_addresses',
    'address_line',
    'INSERT'
  ) then
    raise exception 'Authenticated users cannot create saved addresses';
  end if;
end;
$block$;
