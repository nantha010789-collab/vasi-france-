-- Admin-controlled VASI ride commission. New rides start at 15%, while each
-- ride keeps the percentage that was active when it was booked.
alter table public.vasi_pricing_settings
  add column if not exists ride_commission_percent numeric not null default 15;

update public.vasi_pricing_settings
set ride_commission_percent = 15
where id = 'active';

alter table public.vasi_pricing_settings
  drop constraint if exists vasi_pricing_ride_commission_percent_check,
  add constraint vasi_pricing_ride_commission_percent_check
    check (ride_commission_percent between 0 and 50);

alter table public.rides
  add column if not exists commission_percent numeric not null default 15;

alter table public.rides
  drop constraint if exists rides_commission_percent_check,
  add constraint rides_commission_percent_check
    check (commission_percent between 0 and 50);

create or replace function public.vasi_apply_ride_commission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  configured_percent numeric := 15;
  settlement_fare numeric := 0;
begin
  if tg_op = 'INSERT' then
    select coalesce(settings.ride_commission_percent, 15)
      into configured_percent
    from public.vasi_pricing_settings settings
    where settings.id = 'active';
    new.commission_percent := greatest(
      0,
      least(50, coalesce(configured_percent, 15))
    );
  else
    -- An admin change affects new rides only; an accepted ride keeps its terms.
    new.commission_percent := old.commission_percent;
  end if;

  settlement_fare := case
    when new.status::text = 'completed' and new.final_fare is not null
      then new.final_fare
    else coalesce(new.estimated_fare, 0)
  end;
  new.vasi_commission := round(
    settlement_fare * new.commission_percent / 100,
    2
  );
  new.driver_amount := round(settlement_fare - new.vasi_commission, 2);
  return new;
end;
$$;

revoke all on function public.vasi_apply_ride_commission() from public;
revoke all on function public.vasi_apply_ride_commission() from anon;
revoke all on function public.vasi_apply_ride_commission() from authenticated;

drop trigger if exists vasi_apply_ride_commission on public.rides;
create trigger vasi_apply_ride_commission
before insert or update of
  estimated_fare,
  final_fare,
  status,
  commission_percent,
  vasi_commission,
  driver_amount
on public.rides
for each row execute function public.vasi_apply_ride_commission();

-- Apply the newly selected 15% to rides that have not yet been settled.
update public.rides
set
  commission_percent = 15,
  vasi_commission = round(coalesce(estimated_fare, 0) * 0.15, 2),
  driver_amount = round(
    coalesce(estimated_fare, 0)
      - round(coalesce(estimated_fare, 0) * 0.15, 2),
    2
  )
where status::text in (
  'requested',
  'accepted',
  'driver_arriving',
  'in_progress'
);

comment on column public.vasi_pricing_settings.ride_commission_percent is
  'Admin-controlled commission percentage used for newly booked VASI rides.';
comment on column public.rides.commission_percent is
  'Commission percentage frozen when the ride is booked.';
