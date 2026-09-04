-- Courier applications keep legal documents private and require an admin decision.
-- Bicycle and compliant VAE couriers do not need driving-licence documents.

alter table public.delivery_drivers
  add column if not exists address text,
  add column if not exists application_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_policy_at timestamptz;

alter table public.delivery_drivers
  drop constraint if exists delivery_drivers_application_status_check;

alter table public.delivery_drivers
  add constraint delivery_drivers_application_status_check
  check (application_status in ('pending', 'approved', 'rejected'));

alter table public.delivery_drivers
  drop constraint if exists delivery_drivers_vehicle_type_check;

alter table public.delivery_drivers
  add constraint delivery_drivers_vehicle_type_check
  check (vehicle_type in ('bike', 'ebike', 'scooter', 'moto', 'car'));

create or replace function public.vasi_protect_courier_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if tg_op = 'INSERT' then
    new.verified := false;
    new.application_status := 'pending';
    new.rejection_reason := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  elsif request_role <> 'service_role' then
    new.verified := old.verified;
    new.application_status := old.application_status;
    new.rejection_reason := old.rejection_reason;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
  end if;

  if new.verified then
    new.application_status := 'approved';
  end if;

  return new;
end;
$$;

drop trigger if exists vasi_protect_courier_review_fields on public.delivery_drivers;
create trigger vasi_protect_courier_review_fields
before insert or update on public.delivery_drivers
for each row execute function public.vasi_protect_courier_review_fields();

revoke all on function public.vasi_protect_courier_review_fields() from public;
revoke all on function public.vasi_protect_courier_review_fields() from anon;
revoke all on function public.vasi_protect_courier_review_fields() from authenticated;

create index if not exists delivery_drivers_application_status_created_idx
  on public.delivery_drivers (application_status, created_at desc);

