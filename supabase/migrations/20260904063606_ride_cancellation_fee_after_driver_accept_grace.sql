-- Cancellation is free until two minutes after the driver accepts.
-- After the grace period, a fixed EUR 5 cancellation fee applies.
create or replace function public.vasi_customer_cancel_ride(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  r public.rides;
  fee numeric := 0.00;
  free_until timestamptz;
begin
  select *
    into r
    from public.rides
   where id = p_ride_id
     and customer_id = auth.uid()
   for update;

  if r.id is null then
    raise exception 'Ride not found';
  end if;

  if r.status not in ('requested', 'accepted', 'driver_arriving') then
    raise exception 'This ride can no longer be cancelled';
  end if;

  if r.accepted_at is not null then
    free_until := r.accepted_at + interval '2 minutes';
  end if;

  if r.status in ('accepted', 'driver_arriving')
     and free_until is not null
     and now() >= free_until then
    fee := 5.00;
  end if;

  update public.rides
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_fee = fee,
         final_fare = fee
   where id = r.id
   returning * into r;

  update public.vasi_dispatch_offers
     set status = 'cancelled'
   where job_id = r.id
     and service = 'ride'
     and status = 'pending';

  if r.driver_id is not null then
    update public.drivers
       set online = false,
           updated_at = now()
     where id = r.driver_id;
  end if;

  return jsonb_build_object(
    'ride', to_jsonb(r),
    'cancellation_fee', fee,
    'free_cancellation_until', free_until
  );
end;
$function$;
