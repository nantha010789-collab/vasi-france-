-- ISOLATED TEST DATABASE ONLY. Never load this fixture into a VASI project.
create role anon;
create role authenticated;
create role service_role;
create table public.rides (
  id uuid primary key,
  driver_id uuid,
  mode text,
  status text,
  requested_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  driver_amount numeric
);
create table public.driver_activity_guarantees (
  id bigint generated always as identity primary key,
  driver_id uuid not null,
  period_start date not null,
  period_end date not null,
  ride_count integer not null,
  review_ride_count integer not null,
  activity_seconds numeric not null check (activity_seconds >= 0),
  qualifying_income numeric not null check (qualifying_income >= 0),
  required_income numeric not null check (required_income >= 0),
  top_up_amount numeric not null check (top_up_amount >= 0),
  status text not null,
  calculated_at timestamptz not null,
  updated_at timestamptz not null,
  stripe_transfer_id text,
  paid_at timestamptz,
  unique (driver_id,period_start,period_end)
);
