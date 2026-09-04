create index if not exists delivery_drivers_reviewed_by_idx
  on public.delivery_drivers (reviewed_by)
  where reviewed_by is not null;

