-- Execute after the fixture and production migration in an isolated database.
do $test$
declare
  d uuid := '00000000-0000-0000-0000-000000000001';
  ride uuid := '00000000-0000-0000-0000-000000000002';
  g public.driver_activity_guarantees;
  frozen jsonb;
begin
  -- Immediate: ten-minute approach plus fifty-minute trip = one activity hour.
  insert into public.rides values
    (ride,d,'ride','completed','2024-09-15 09:59+02','2024-09-15 10:00+02',
     '2024-09-15 10:10+02','2024-09-15 11:00+02',25);
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  select * into strict g from public.driver_activity_guarantees;
  assert g.activity_seconds=3600 and g.required_income=30 and g.top_up_amount=5
    and g.status='pending', 'immediate pickup time / income arithmetic';
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select count(*) from public.driver_activity_guarantees)=1,
    'repeat reconciliation must not duplicate the period';
  insert into public.rides values
    ('00000000-0000-0000-0000-000000000003',d,'ride','completed',
     '2024-09-16 09:59+02','2024-09-16 10:00+02','2024-09-16 10:10+02',
     '2024-09-16 11:00+02',35);
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select activity_seconds=7200 and qualifying_income=60 and top_up_amount=0
    from public.driver_activity_guarantees), 'aggregate monthly income, not per-trip topups';
  delete from public.rides where id<>ride;

  -- France calendar boundary must not depend on the PostgreSQL session zone.
  update public.rides set accepted_at='2024-10-01 00:00+02',
    started_at='2024-10-01 00:05+02',completed_at='2024-10-01 00:30+02';
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  select * into strict g from public.driver_activity_guarantees;
  assert g.ride_count=0 and g.top_up_amount=0, 'October trip must not enter September';
  update public.rides set accepted_at='2024-09-01 00:00+02',
    started_at='2024-09-01 00:05+02',completed_at='2024-09-01 00:30+02',driver_amount=10;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  select * into strict g from public.driver_activity_guarantees;
  assert g.ride_count=1 and g.top_up_amount=5, 'early September trip must enter September';
  perform set_config('TimeZone','America/New_York',true);
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select top_up_amount=5 from public.driver_activity_guarantees), 'session zone independence';
  perform set_config('TimeZone','UTC',true);

  -- Advance reservation: 15% of trip time, capped at five minutes.
  update public.rides set mode='reserve',accepted_at=null,
    started_at='2024-09-15 10:00+02',completed_at='2024-09-15 10:20+02';
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  select * into strict g from public.driver_activity_guarantees;
  assert g.activity_seconds=1380 and g.required_income=11.5 and g.top_up_amount=1.5,
    'advance reservation proportional approach';
  update public.rides set completed_at='2024-09-15 11:00+02';
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select activity_seconds=3900 and required_income=32.5
    from public.driver_activity_guarantees), 'advance reservation five-minute cap';

  -- A malformed trip must not subtract activity or become payable.
  update public.rides set mode='ride',accepted_at='2024-09-15 12:00+02';
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select activity_seconds=0 and review_ride_count=1 and status='needs_review'
    from public.driver_activity_guarantees), 'reversed timestamps must require review';
  update public.rides set accepted_at='2024-09-15 09:00+02',completed_at=null;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select ride_count=1 and review_ride_count=1 and status='needs_review'
    from public.driver_activity_guarantees), 'missing completion must not disappear';
  update public.rides set completed_at='2024-09-15 11:00+02',driver_amount=null;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select status='needs_review' from public.driver_activity_guarantees),
    'unknown income must not be treated as a payable zero';

  -- Couriers are outside the VTC guarantee and stale unpaid rows are cleared.
  update public.rides set mode='courier',driver_amount=10;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select ride_count=0 and activity_seconds=0 and top_up_amount=0 and status='not_due'
    from public.driver_activity_guarantees), 'courier exclusion / stale unpaid snapshot';

  -- Paid and claimed snapshots must remain byte-for-byte unchanged on rerun.
  update public.rides set mode='ride',driver_amount=10;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  update public.driver_activity_guarantees set status='processing';
  select to_jsonb(x) into frozen from public.driver_activity_guarantees x;
  update public.rides set driver_amount=20;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select to_jsonb(x)=frozen from public.driver_activity_guarantees x), 'claimed snapshot frozen';
  update public.driver_activity_guarantees set status='paid',stripe_transfer_id='TEST_ONLY',paid_at=now();
  select to_jsonb(x) into frozen from public.driver_activity_guarantees x;
  update public.rides set driver_amount=25;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-09-01','2024-10-01');
  assert (select to_jsonb(x)=frozen from public.driver_activity_guarantees x), 'paid snapshot frozen';

  -- Spring daylight-saving transition: elapsed activity is one hour, not two.
  update public.rides set accepted_at='2024-03-31 01:30+01',
    started_at='2024-03-31 01:40+01',completed_at='2024-03-31 03:30+02',driver_amount=25;
  perform public.vasi_reconcile_driver_activity_guarantees('2024-03-01','2024-04-01');
  assert (select activity_seconds=3600 and top_up_amount=5
    from public.driver_activity_guarantees where period_start='2024-03-01'), 'DST elapsed time';

  -- Monthly periods cannot overlap or be paid before they close.
  begin
    perform public.vasi_reconcile_driver_activity_guarantees('2024-09-02','2024-10-01');
    raise exception 'accepted an overlapping partial month';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.vasi_reconcile_driver_activity_guarantees(
      date_trunc('month',now() at time zone 'Europe/Paris')::date,
      (date_trunc('month',now() at time zone 'Europe/Paris')+interval '1 month')::date);
    raise exception 'accepted an open month';
  exception when invalid_parameter_value then null;
  end;
  assert not has_function_privilege('anon',
    'public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)','execute'), 'anon denied';
  assert not has_function_privilege('authenticated',
    'public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)','execute'), 'browser users denied';
  assert has_function_privilege('service_role',
    'public.vasi_reconcile_driver_activity_guarantees(date,date,uuid)','execute'), 'backend allowed';
end;
$test$;
