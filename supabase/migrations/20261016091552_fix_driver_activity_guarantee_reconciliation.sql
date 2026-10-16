-- Monthly VTC activity guarantees use French calendar dates, not the DB session zone.
-- Keep these existing reconciliation RPCs service-only; no browser role can run them.
create or replace function public.vasi_reconcile_driver_activity_guarantees(
  p_period_start date,
  p_period_end date,
  p_driver_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare affected integer := 0;
begin
  if p_period_start is null or p_period_end is null
     or p_period_start <> date_trunc('month', p_period_start::timestamp)::date
     or p_period_end <> (p_period_start + interval '1 month')::date
     or p_period_end > date_trunc('month', now() at time zone 'Europe/Paris')::date then
    raise exception 'A closed French calendar month is required' using errcode = '22023';
  end if;

  with selected_rides as (
    select r.*,
      coalesce(
        r.completed_at is not null and r.started_at is not null
        and r.started_at <= r.completed_at
        and (r.accepted_at is null or r.accepted_at <= r.started_at)
        and (r.mode::text = 'reserve' or r.accepted_at is not null)
        and r.driver_amount is not null and r.driver_amount >= 0
        and r.driver_amount::text not in ('NaN', 'Infinity', '-Infinity'),
        false
      ) as valid_activity
    from public.rides r
    where r.status::text = 'completed'
      and r.mode::text in ('ride', 'reserve')
      and r.driver_id is not null
      and (p_driver_id is null or r.driver_id = p_driver_id)
      -- Missing completion times remain visible for review in their best-known month.
      and coalesce(r.completed_at, r.started_at, r.accepted_at, r.requested_at)
          >= (p_period_start::timestamp at time zone 'Europe/Paris')
      and coalesce(r.completed_at, r.started_at, r.accepted_at, r.requested_at)
          < (p_period_end::timestamp at time zone 'Europe/Paris')
  ), period_drivers as (
    select driver_id from selected_rides
    union
    -- Rebuild an unpaid row even if its last eligible trip was corrected/removed.
    select g.driver_id from public.driver_activity_guarantees g
    where g.period_start = p_period_start and g.period_end = p_period_end
      and (p_driver_id is null or g.driver_id = p_driver_id)
  ), ride_activity as (
    select d.driver_id,
      count(r.id)::integer as ride_count,
      count(r.id) filter (where not r.valid_activity)::integer as review_ride_count,
      coalesce(sum(case
        when not r.valid_activity then 0
        when r.mode::text = 'reserve' then
          extract(epoch from (r.completed_at - r.started_at))
          + least(extract(epoch from (r.completed_at - r.started_at)) * 0.15, 300)
        when r.mode::text = 'ride' then
          extract(epoch from (r.completed_at - r.accepted_at))
        else 0
      end), 0) as activity_seconds,
      round(coalesce(sum(case
        when r.driver_amount >= 0
          and r.driver_amount::text not in ('NaN', 'Infinity', '-Infinity')
        then r.driver_amount else 0 end), 0), 2) as qualifying_income
    from period_drivers d
    left join selected_rides r on r.driver_id = d.driver_id
    group by d.driver_id
  ), calculated as (
    select *, round(activity_seconds / 3600 * 30, 2) as required_income,
      greatest(round(activity_seconds / 3600 * 30, 2) - qualifying_income, 0) as top_up_amount
    from ride_activity
  )
  insert into public.driver_activity_guarantees as existing (
    driver_id, period_start, period_end, ride_count, review_ride_count,
    activity_seconds, qualifying_income, required_income, top_up_amount,
    status, calculated_at, updated_at
  )
  select driver_id, p_period_start, p_period_end, ride_count, review_ride_count,
    activity_seconds, qualifying_income, required_income, top_up_amount,
    case when review_ride_count > 0 then 'needs_review'
         when top_up_amount > 0 then 'pending' else 'not_due' end,
    now(), now()
  from calculated
  on conflict (driver_id, period_start, period_end) do update set
    ride_count = excluded.ride_count,
    review_ride_count = excluded.review_ride_count,
    activity_seconds = excluded.activity_seconds,
    qualifying_income = excluded.qualifying_income,
    required_income = excluded.required_income,
    top_up_amount = excluded.top_up_amount,
    status = excluded.status,
    calculated_at = now(), updated_at = now()
  -- ON CONFLICT locks the row before evaluating this condition. A concurrent
  -- payout claim therefore freezes the entire snapshot, including the amount.
  where existing.status not in ('paid', 'processing')
    and existing.stripe_transfer_id is null and existing.paid_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$function$;
revoke all on function public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)
  from public, anon, authenticated;
grant execute on function public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)
  to service_role;

create or replace function public.vasi_reconcile_previous_month_driver_guarantees()
returns integer
language sql
security invoker
set search_path = pg_catalog, public
as $function$
  select public.vasi_reconcile_driver_activity_guarantees(
    (date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month')::date,
    date_trunc('month', now() at time zone 'Europe/Paris')::date,
    null
  );
$function$;
revoke all on function public.vasi_reconcile_previous_month_driver_guarantees()
  from public, anon, authenticated;
grant execute on function public.vasi_reconcile_previous_month_driver_guarantees()
  to service_role;
