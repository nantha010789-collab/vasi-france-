-- Cache auth.uid() once per statement for the driver guarantee read policy.
drop policy if exists driver_reads_own_activity_guarantees
  on public.driver_activity_guarantees;

create policy driver_reads_own_activity_guarantees
on public.driver_activity_guarantees for select to authenticated
using (exists (
  select 1 from public.drivers d
  where d.id = driver_activity_guarantees.driver_id
    and d.user_id = (select auth.uid())
));
