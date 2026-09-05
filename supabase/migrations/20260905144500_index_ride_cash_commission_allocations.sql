-- Cover the allocation-to-debt foreign key used during payout reconciliation.
create index if not exists driver_ride_cash_offset_allocations_debt_idx
  on public.driver_ride_cash_offset_allocations (debt_id);
