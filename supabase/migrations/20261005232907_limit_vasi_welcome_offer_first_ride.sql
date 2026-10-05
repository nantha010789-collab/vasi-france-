create or replace function private.vasi_guard_first_ride_offer()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  -- Serialize bookings for this customer, including undiscounted bookings.
  perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));
  if new.fare_model = 'vasi_funded_v1' and coalesce(new.platform_funded_discount, 0) > 0 then
    if new.platform_funded_discount > least(1, round(new.regular_fare * 0.05, 2)) then
      raise exception 'Welcome offer is limited to 5 percent and EUR 1' using errcode='22023';
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
drop trigger if exists zz_vasi_guard_first_ride_offer on public.rides;
create trigger zz_vasi_guard_first_ride_offer before insert on public.rides
for each row execute function private.vasi_guard_first_ride_offer();

update public.vasi_pricing_settings
set ride_commission_percent=12, offer_mode='fixed', discount_percent=5,
    max_discount_eur=1
where id='active';