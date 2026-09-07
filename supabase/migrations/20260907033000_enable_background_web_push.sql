-- Server-dispatched Web Push for customer ride, Eats, and Delivery status updates.
-- VAPID and hook secrets are stored separately in Supabase Vault.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 8 and 300),
  customer_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('ride', 'eats', 'delivery')),
  entity_id uuid not null,
  status text not null check (char_length(status) between 2 and 80),
  delivery_status text not null default 'processing' check (
    delivery_status in ('processing', 'sent', 'partial', 'failed', 'no_subscriptions')
  ),
  attempted_count integer not null default 0 check (attempted_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists push_notification_events_customer_created_idx
  on public.push_notification_events (customer_id, created_at desc);

alter table public.push_notification_events enable row level security;
revoke all on table public.push_notification_events from public, anon, authenticated;
grant select, insert, update on table public.push_notification_events to service_role;

create or replace function public.get_vasi_push_credentials()
returns table (
  public_key text,
  private_key text,
  subject text,
  hook_secret text
)
language sql
security definer
set search_path = pg_catalog, public, vault
as $$
  select
    max(decrypted_secret) filter (where name = 'vasi_vapid_public_key'),
    max(decrypted_secret) filter (where name = 'vasi_vapid_private_key'),
    max(decrypted_secret) filter (where name = 'vasi_vapid_subject'),
    max(decrypted_secret) filter (where name = 'vasi_push_hook_secret')
  from vault.decrypted_secrets
  where name in (
    'vasi_vapid_public_key',
    'vasi_vapid_private_key',
    'vasi_vapid_subject',
    'vasi_push_hook_secret'
  );
$$;

revoke all on function public.get_vasi_push_credentials() from public, anon, authenticated;
grant execute on function public.get_vasi_push_credentials() to service_role;

create or replace function public.enqueue_vasi_customer_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  hook_secret text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select decrypted_secret
    into hook_secret
  from vault.decrypted_secrets
  where name = 'vasi_push_hook_secret'
  limit 1;

  if hook_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://vhfyvkrvysrooaqzcxsp.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-vasi-hook-secret', hook_secret
    ),
    body := jsonb_build_object(
      'table', tg_table_name,
      'record', jsonb_build_object(
        'id', new.id,
        'status', new.status
      )
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.enqueue_vasi_customer_push() from public, anon, authenticated;

drop trigger if exists rides_customer_push_status on public.rides;
create trigger rides_customer_push_status
after update of status on public.rides
for each row execute function public.enqueue_vasi_customer_push();

drop trigger if exists eats_customer_push_status on public.eats_orders;
create trigger eats_customer_push_status
after update of status on public.eats_orders
for each row execute function public.enqueue_vasi_customer_push();

drop trigger if exists delivery_customer_push_status on public.delivery_orders;
create trigger delivery_customer_push_status
after update of status on public.delivery_orders
for each row execute function public.enqueue_vasi_customer_push();

