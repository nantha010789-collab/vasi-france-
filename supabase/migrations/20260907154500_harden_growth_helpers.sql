-- Cover new foreign keys and keep private RLS helper functions callable only
-- by the signed-in role used by their policies.

create index if not exists business_accounts_owner_idx
  on public.business_accounts (owner_id);
create index if not exists business_invoices_generated_by_idx
  on public.business_monthly_invoices (generated_by);
create index if not exists eats_group_members_user_idx
  on public.eats_group_order_members (user_id);
create index if not exists eats_group_orders_host_idx
  on public.eats_group_orders (host_user_id);
create index if not exists eats_group_orders_restaurant_idx
  on public.eats_group_orders (restaurant_id);

revoke execute on function private.is_business_member(uuid,text[]) from public, anon;
revoke execute on function private.is_group_member(uuid) from public, anon;
revoke execute on function private.is_group_host(uuid) from public, anon;
