import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261002020316_harden_security_defaults_and_fk_indexes.sql",
    import.meta.url,
  ),
  "utf8",
);

test("future database functions require an explicit browser-role grant", () => {
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public[\s\S]*revoke execute on functions from public, anon, authenticated/i,
  );
});

test("security-definer functions use a trusted search path", () => {
  assert.match(migration, /procedure\.prosecdef/i);
  assert.match(migration, /search_path = pg_catalog, public/i);
  assert.match(migration, /procedure\.proconfig = array\['search_path=public'\]::text\[\]/i);
});

test("service-only tables keep explicit browser-role deny policies", () => {
  for (const table of [
    "admin_allowlist",
    "admin_audit_log",
    "driver_cash_commission_debts",
    "driver_payout_settings",
    "driver_payouts",
    "driver_ride_cash_offset_allocations",
    "driver_ride_cash_offsets",
    "platform_settings",
    "push_notification_events",
    "vasi_discount_redemptions",
    "vasi_discounts",
    "vasi_payment_events",
    "vasi_ride_stops",
  ]) {
    assert.ok(migration.includes(`'${table}'`), `missing service-only policy for ${table}`);
  }
  assert.match(
    migration,
    /for all to anon, authenticated using \(false\) with check \(false\)/i,
  );
});

test("all advisor-reported foreign keys receive covering indexes", () => {
  for (const index of [
    "account_deletion_requests_processed_by_idx",
    "courier_eats_earnings_courier_id_idx",
    "eats_order_safety_customer_id_idx",
    "eats_orders_group_order_id_idx",
    "restaurant_menu_items_photo_reviewed_by_idx",
    "ride_call_signals_sender_id_idx",
    "ride_safety_customer_id_idx",
    "vasi_pricing_settings_updated_by_idx",
  ]) {
    assert.match(migration, new RegExp(`create index if not exists ${index}`, "i"));
  }
});
