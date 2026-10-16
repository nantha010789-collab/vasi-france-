-- ISOLATED TEST DATABASE ONLY; load after driver-guarantee-schema.sql.
create schema private;
alter table public.rides add customer_id uuid,
  add fare_model text,
  add regular_fare numeric,
  add gross_vasi_commission numeric,
  add platform_funded_discount numeric;
create table public.vasi_pricing_settings(id text primary key,discount_percent numeric,max_discount_eur numeric);
insert into public.vasi_pricing_settings values ('active',5,1);
