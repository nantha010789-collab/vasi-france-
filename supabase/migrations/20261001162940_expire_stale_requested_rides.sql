-- Automatically close ride requests that can no longer be matched.
-- Unscheduled requests expire after 15 minutes; scheduled requests expire
-- 15 minutes after their requested pickup time. Expiry is always fee-free.

create index if not exists rides_requested_expiry_idx
  on public.rides ((coalesce(scheduled_for, requested_at)))
  where status = 'requested' and driver_id is null;

create or replace function public.expire_stale_requested_rides()
returns integer
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  expired_ids uuid[] := '{}'::uuid[];
  expired_count integer := 0;
begin
  with expired as (
    update public.rides
       set status = 'cancelled',
           cancelled_at = now(),
           cancellation_fee = 0,
           final_fare = 0
     where status = 'requested'
       and driver_id is null
       and coalesce(scheduled_for, requested_at) < now() - interval '15 minutes'
     returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]), count(*)::integer
    into expired_ids, expired_count
    from expired;

  if expired_count > 0 then
    update public.vasi_dispatch_offers
       set status = 'cancelled',
           responded_at = coalesce(responded_at, now())
     where service = 'ride'
       and job_id = any(expired_ids)
       and status = 'pending';
  end if;

  return expired_count;
end;
$function$;

revoke all on function public.expire_stale_requested_rides() from public, anon, authenticated;
grant execute on function public.expire_stale_requested_rides() to service_role;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'expire-vasi-stale-requested-rides';

    perform cron.schedule(
      'expire-vasi-stale-requested-rides',
      '*/5 * * * *',
      'select public.expire_stale_requested_rides();'
    );
  end if;
exception
  when others then
    raise notice 'Stale ride expiry cron must be configured separately: %', sqlerrm;
end;
$block$;

comment on function public.expire_stale_requested_rides() is
  'Cancels unmatched stale ride requests without charging the customer.';
