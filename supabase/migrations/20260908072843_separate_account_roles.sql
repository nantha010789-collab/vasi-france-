set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_role text not null
    check (account_role in ('customer', 'ride', 'courier', 'restaurant')),
  created_at timestamptz not null default now()
);

alter table public.account_roles enable row level security;

revoke all on table public.account_roles from public, anon, authenticated;
grant select, insert on table public.account_roles to authenticated;
grant select, insert, update, delete on table public.account_roles to service_role;

drop policy if exists account_roles_select_own on public.account_roles;
create policy account_roles_select_own
on public.account_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists account_roles_insert_own on public.account_roles;
create policy account_roles_insert_own
on public.account_roles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Existing partner ownership takes priority over the historical customer
-- default in profiles. Names may match, but each Auth identity gets one role.
insert into public.account_roles (user_id, account_role)
select
  auth_user.id,
  case
    when exists (
      select 1 from public.restaurants restaurant
      where restaurant.owner_id = auth_user.id
    ) then 'restaurant'
    when exists (
      select 1 from public.delivery_drivers courier
      where courier.user_id = auth_user.id
    ) then 'courier'
    when exists (
      select 1 from public.drivers driver
      where driver.user_id = auth_user.id
    ) then 'ride'
    else 'customer'
  end
from auth.users auth_user
on conflict (user_id) do nothing;

create or replace function public.vasi_claim_account_role(p_role text)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  claimed_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_role not in ('customer', 'ride', 'courier', 'restaurant') then
    raise exception 'Invalid VASI account type';
  end if;

  insert into public.account_roles (user_id, account_role)
  values ((select auth.uid()), p_role)
  on conflict (user_id) do nothing;

  select account_role
  into claimed_role
  from public.account_roles
  where user_id = (select auth.uid());

  if claimed_role is distinct from p_role then
    raise exception 'This login belongs to a different VASI account type. Sign out and use the separate login details for this account.';
  end if;

  return claimed_role;
end;
$function$;

revoke all on function public.vasi_claim_account_role(text) from public, anon;
grant execute on function public.vasi_claim_account_role(text) to authenticated;
