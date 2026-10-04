-- Minimum protection for newly booked rides only. Never rewrite existing rides.
CREATE OR REPLACE FUNCTION public.vasi_apply_ride_commission()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
declare
  configured_percent numeric := 12;
  settlement_fare numeric := 0;
begin
  if tg_op = 'INSERT' then
    select coalesce(settings.ride_commission_percent, 12) into configured_percent
    from public.vasi_pricing_settings settings where settings.id = 'active';
    new.commission_percent := greatest(0, least(50, coalesce(configured_percent, 12)));
  else
    new.commission_percent := old.commission_percent;
  end if;
  settlement_fare := case
    when new.status::text = 'completed' and new.final_fare is not null then new.final_fare
    else coalesce(new.estimated_fare, 0)
  end;
  new.vasi_commission := round(settlement_fare * new.commission_percent / 100, 2);
  new.driver_amount := round(settlement_fare - new.vasi_commission, 2);
  if tg_op = 'INSERT' and new.driver_amount < 9 then
    raise exception 'Ride fare must protect a minimum driver payout of EUR 9' using errcode = '22023';
  end if;
  return new;
end;
$function$;

-- Keep base/km/minute rates, commission and offer settings unchanged.
UPDATE public.vasi_pricing_settings
SET go_minimum = greatest(go_minimum, ceil(900 / (1 - ride_commission_percent / 100)) / 100),
    comfort_minimum = greatest(comfort_minimum, ceil(900 / (1 - ride_commission_percent / 100)) / 100),
    xl_minimum = greatest(xl_minimum, ceil(900 / (1 - ride_commission_percent / 100)) / 100),
    van_minimum = greatest(van_minimum, ceil(900 / (1 - ride_commission_percent / 100)) / 100)
WHERE id = 'active';
