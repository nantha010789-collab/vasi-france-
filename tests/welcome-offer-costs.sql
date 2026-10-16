-- Execute in an isolated database after the fixture and production migration.
create trigger zz_test_welcome before insert on public.rides
for each row execute function private.vasi_guard_first_ride_offer();
do $test$
declare c uuid := '00000000-0000-0000-0000-000000000010';
begin
  -- EUR 60.04: commission 7.20, payment allowance 2.41, operating reserve 2.
  insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
    values ('00000000-0000-0000-0000-000000000011',c,'requested','vasi_funded_v1',60.04,7.20,2.79);
  begin
    insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
      values ('00000000-0000-0000-0000-000000000012',c,'requested','vasi_funded_v1',60.04,7.20,2.79);
    raise exception 'accepted a second welcome offer';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
      values ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000020','requested','vasi_funded_v1',60.04,7.20,3);
    raise exception 'cost reserve was consumed';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
      values ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000020','requested','vasi_funded_v1',100,12,3.01);
    raise exception 'EUR 3 cap was exceeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
      values ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000020','requested','vasi_funded_v1',10.23,1.23,.01);
    raise exception 'low-commission trip was discounted';
  exception when invalid_parameter_value then null;
  end;
  insert into public.rides(id,customer_id,status,fare_model,regular_fare,gross_vasi_commission,platform_funded_discount)
    values ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000020','requested','vasi_funded_v1',100,12,3);
  assert (select max_discount_eur=3 and discount_percent=5 from public.vasi_pricing_settings where id='active'), 'welcome configuration';
  assert not has_function_privilege('authenticated','private.vasi_guard_first_ride_offer()','execute'), 'trigger helper not exposed';
end;
$test$;
