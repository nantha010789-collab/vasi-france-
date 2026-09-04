-- Keep an accepted driver available after the customer cancels.
-- Only authenticated customers may execute their cancellation RPC.
begin;

create or replace function public.vasi_customer_cancel_ride(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
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

  -- Do not force the assigned driver offline. Cancelling this ride releases
  -- the trip while preserving the driver's own availability preference.
  return jsonb_build_object(
    'ride', to_jsonb(r),
    'cancellation_fee', fee,
    'free_cancellation_until', free_until
  );
end;
$function$;

revoke all on function public.vasi_customer_cancel_ride(uuid) from public;
revoke all on function public.vasi_customer_cancel_ride(uuid) from anon;
revoke all on function public.vasi_customer_cancel_ride(uuid) from authenticated;
grant execute on function public.vasi_customer_cancel_ride(uuid) to authenticated;

commit;
