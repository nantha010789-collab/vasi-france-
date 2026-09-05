revoke all on table public.eats_orders from anon, authenticated;
grant select on table public.eats_orders to authenticated;

revoke all on table public.delivery_drivers from anon, authenticated;
grant select, insert on table public.delivery_drivers to authenticated;
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

comment on table public.eats_orders is
  'VASI Eats orders. Client roles may read authorized rows; all mutations use validated server operations.';
