-- Prevent future public-schema functions created by the migration owner from
-- becoming callable by every browser role unless a migration grants EXECUTE
-- explicitly. Existing app RPC grants are intentionally left unchanged.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Keep SECURITY DEFINER resolution anchored to trusted system objects before
-- the public application schema. Functions that intentionally need additional
-- schemas (for example extensions, vault or net) are not changed here.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select format(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)
    )
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proconfig = array['search_path=public']::text[]
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public',
      function_signature
    );
  end loop;
end;
$$;

-- These tables are written only by trusted server functions/service-role
-- operations. An explicit false policy documents and preserves the existing
-- no-direct-browser-access behavior while keeping RLS enabled.
do $$
declare
  service_table text;
begin
  foreach service_table in array array[
    'admin_allowlist',
    'admin_audit_log',
    'driver_cash_commission_debts',
    'driver_payout_settings',
    'driver_payouts',
    'driver_ride_cash_offset_allocations',
    'driver_ride_cash_offsets',
    'platform_settings',
    'push_notification_events',
    'vasi_discount_redemptions',
    'vasi_discounts',
    'vasi_payment_events',
    'vasi_ride_stops'
  ]
  loop
    execute format(
      'drop policy if exists service_only_no_direct_access on public.%I',
      service_table
    );
    execute format(
      'create policy service_only_no_direct_access on public.%I for all to anon, authenticated using (false) with check (false)',
      service_table
    );
  end loop;
end;
$$;

-- Cover every currently reported foreign-key lookup. These indexes improve
-- joins and parent-row updates/deletes without changing application behavior.
create index if not exists account_deletion_requests_processed_by_idx
  on public.account_deletion_requests (processed_by);

create index if not exists courier_eats_earnings_courier_id_idx
  on public.courier_eats_earnings (courier_id);

create index if not exists eats_order_safety_customer_id_idx
  on public.eats_order_safety (customer_id);

create index if not exists eats_orders_group_order_id_idx
  on public.eats_orders (group_order_id);

create index if not exists restaurant_menu_items_photo_reviewed_by_idx
  on public.restaurant_menu_items (photo_reviewed_by);

create index if not exists ride_call_signals_sender_id_idx
  on public.ride_call_signals (sender_id);

create index if not exists ride_safety_customer_id_idx
  on public.ride_safety (customer_id);

create index if not exists vasi_pricing_settings_updated_by_idx
  on public.vasi_pricing_settings (updated_by);
