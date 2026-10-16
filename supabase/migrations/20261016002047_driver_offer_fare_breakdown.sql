-- Reuse the existing verified-driver, own-pending-offer authorization gate.
create schema if not exists vasi_internal;
revoke all on schema vasi_internal from public, anon;
grant usage on schema vasi_internal to authenticated;
create or replace function vasi_internal.driver_offer_pricing()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  select pg_catalog.to_jsonb(offer) || pg_catalog.jsonb_build_object(
    'commission_percent', ride.commission_percent,
    'vasi_commission', ride.vasi_commission,
    'gross_vasi_commission', ride.gross_vasi_commission,
    'regular_fare', ride.regular_fare,
    'customer_discount', ride.customer_discount,
    'estimated_distance_km', ride.estimated_distance_km,
    'estimated_duration_minutes', ride.estimated_duration_minutes
  )
  from public.vasi_driver_offer_details() as offer
  join public.rides as ride on ride.id = offer.ride_id;
end;
$function$;
revoke all on function vasi_internal.driver_offer_pricing() from public, anon;
grant execute on function vasi_internal.driver_offer_pricing() to authenticated;
create or replace function public.vasi_driver_offer_pricing()
returns setof jsonb
language sql
security invoker
set search_path = ''
as $function$
  select * from vasi_internal.driver_offer_pricing();
$function$;
revoke all on function public.vasi_driver_offer_pricing() from public, anon;
grant execute on function public.vasi_driver_offer_pricing() to authenticated;
