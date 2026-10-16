create or replace function private.vasi_guard_first_ride_offer()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  -- Serialize bookings for this customer, including undiscounted bookings.
  perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));
  if new.fare_model = 'vasi_funded_v1' and coalesce(new.platform_funded_discount, 0) > 0 then
    if new.platform_funded_discount > least(3, round(new.regular_fare * 0.05, 2),
      greatest(0, new.gross_vasi_commission -
        (ceil(new.regular_fare * 3.5) / 100 + 0.30 + 2.00))) then
      raise exception 'Welcome offer exceeds the 5 percent, EUR 3 or platform cost-reserve limit' using errcode='22023';
    end if;
    if exists (
      select 1 from public.rides r
      where r.customer_id = new.customer_id and r.status::text <> 'cancelled'
    ) then
      raise exception 'Welcome offer is only available for the first ride' using errcode='22023';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.vasi_guard_first_ride_offer() from public, anon, authenticated;

-- Up to EUR 3; the actual discount may be lower to preserve the cost allowance.
-- Existing ride fares and driver earnings are not rewritten.
update public.vasi_pricing_settings
set discount_percent=5, max_discount_eur=3
where id='active';
