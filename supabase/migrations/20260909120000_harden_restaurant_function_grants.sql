-- Keep restaurant-owner menu changes behind an authenticated user JWT.
revoke all on function public.vasi_restaurant_update_item(uuid, text, text, text, numeric, text[], boolean)
  from public, anon;
grant execute on function public.vasi_restaurant_update_item(uuid, text, text, text, numeric, text[], boolean)
  to authenticated, service_role;

-- Restaurant approval is an admin-service operation, never a direct client RPC.
revoke all on function public.vasi_review_restaurant(uuid, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.vasi_review_restaurant(uuid, text, text, numeric)
  to service_role;
