drop policy if exists "customers can create eats orders" on public.eats_orders;
drop policy if exists "verified couriers can update eats lifecycle" on public.eats_orders;

revoke insert, update, delete on table public.eats_orders from anon, authenticated;
grant select on table public.eats_orders to authenticated;

drop policy if exists "verified couriers can view available and assigned eats orders"
  on public.eats_orders;
create policy "verified couriers can view available and assigned eats orders"
on public.eats_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.delivery_drivers dd
    where dd.user_id = (select auth.uid())
      and dd.verified = true
      and (
        eats_orders.delivery_driver_id = dd.id
        or (
          eats_orders.status = 'pending'
          and eats_orders.payment_status = 'paid'
          and eats_orders.delivery_mode = 'vasi'
          and eats_orders.delivery_driver_id is null
          and dd.online = true
        )
      )
  )
);

drop policy if exists "courier can create own profile" on public.delivery_drivers;
create policy "courier can create own profile"
on public.delivery_drivers
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and verified = false
  and online = false
  and stripe_account_id is null
  and stripe_details_submitted = false
  and stripe_payouts_enabled = false
);

revoke update on table public.delivery_drivers from authenticated;
grant update (
  full_name,
  phone,
  vehicle_type,
  online,
  latitude,
  longitude,
  documents,
  address,
  accepted_policy_at,
  updated_at
) on table public.delivery_drivers to authenticated;

comment on policy "verified couriers can view available and assigned eats orders"
  on public.eats_orders is
  'Only paid VASI-delivery orders are visible before assignment; assigned orders remain visible to their courier.';
