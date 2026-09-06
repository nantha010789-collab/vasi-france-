import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const stripeClient = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe payout service is not configured");
  return new Stripe(key, { apiVersion: "2025-07-30.basil" });
};

async function configureWeeklyMondayPayout(accountId: string) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe payout service is not configured");
  const params = new URLSearchParams();
  params.set("payments[payouts][schedule][interval]", "weekly");
  params.append("payments[payouts][schedule][weekly_payout_days][]", "monday");
  const response = await fetch("https://api.stripe.com/v1/balance_settings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": accountId,
    },
    body: params.toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error?.message || "Weekly payout schedule could not be configured");
}

function payoutState(account: Stripe.Account | null) {
  return {
    connected: Boolean(account?.id),
    details_submitted: Boolean(account?.details_submitted),
    payouts_enabled: Boolean(account?.payouts_enabled),
    payout_schedule: { interval: "weekly", day: "monday" },
  };
}

async function releaseRestaurantPayout(
  serviceClient: ReturnType<typeof createClient>,
  restaurant: Record<string, any>,
  order: Record<string, any>,
) {
  if (order.restaurant_transfer_id)
    return { status: "paid", transfer_id: order.restaurant_transfer_id };

  const accountId = String(restaurant.stripe_account_id || "");
  if (!accountId || !restaurant.stripe_payouts_enabled) {
    await serviceClient.from("eats_orders").update({
      restaurant_payout_status: "requires_onboarding",
    }).eq("id", order.id);
    return { status: "requires_onboarding", message: "Restaurant must connect and verify its RIB" };
  }

  const stripe = stripeClient();
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (
      (account.metadata?.vasi_restaurant_id &&
        account.metadata.vasi_restaurant_id !== restaurant.id) ||
      !account.details_submitted ||
      !account.payouts_enabled
    ) {
      await serviceClient.from("eats_orders").update({
        restaurant_payout_status: "requires_onboarding",
      }).eq("id", order.id);
      return { status: "requires_onboarding", message: "Restaurant RIB verification is incomplete" };
    }

    const paymentIntentId = String(order.stripe_payment_intent_id || "");
    if (!paymentIntentId) throw new Error("Paid order has no payment reference");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId = typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;
    if (paymentIntent.status !== "succeeded" || !chargeId)
      throw new Error("Customer payment is not settled");

    const payoutValue = Number(order.restaurant_net || 0) +
      (order.delivery_mode === "own" ? Number(order.delivery_fee || 0) : 0);
    const amount = Math.round(payoutValue * 100);
    if (!Number.isFinite(amount) || amount < 1)
      throw new Error("Restaurant payout amount is invalid");

    const transfer = await stripe.transfers.create({
      amount,
      currency: String(order.currency || "eur").toLowerCase(),
      destination: accountId,
      source_transaction: chargeId,
      transfer_group: `VASI_EATS_${order.id}`,
      metadata: {
        vasi_service: "eats",
        vasi_order_id: String(order.id),
        vasi_restaurant_id: String(restaurant.id),
      },
    }, { idempotencyKey: `vasi-eats-restaurant-${order.id}` });
    const paidAt = new Date().toISOString();
    await serviceClient.from("eats_orders").update({
      restaurant_payout_status: "paid",
      restaurant_transfer_id: transfer.id,
      restaurant_paid_at: paidAt,
    }).eq("id", order.id);
    return {
      status: "paid",
      amount: amount / 100,
      currency: order.currency || "EUR",
      transfer_id: transfer.id,
    };
  } catch (error) {
    await serviceClient.from("eats_orders").update({
      restaurant_payout_status: "failed",
    }).eq("id", order.id);
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Restaurant payout needs review",
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");
  const stripe = stripeClient();
  const now = new Date().toISOString();
  const publicUrl = Deno.env.get("VASI_PUBLIC_URL") || "https://vasi-new.vercel.app";

  try {
    if (action === "driver_status" || action === "driver_onboarding") {
      const { data: driver, error } = await userClient.from("drivers").select("*")
        .eq("user_id", user.id).maybeSingle();
      if (error || !driver) return json({ error: "Driver profile required" }, 404);
      if (!driver.verified)
        return json({ error: "Driver must be verified before Stripe onboarding" }, 403);

      let accountId = String(driver.stripe_account_id || "");
      let account: Stripe.Account | null = accountId
        ? await stripe.accounts.retrieve(accountId)
        : null;
      if (account?.metadata?.vasi_driver_id && account.metadata.vasi_driver_id !== driver.id)
        return json({ error: "Driver payout account does not match" }, 409);

      if (action === "driver_status") {
        const state = payoutState(account);
        await serviceClient.from("drivers").update({
          stripe_details_submitted: state.details_submitted,
          stripe_payouts_enabled: state.payouts_enabled,
          ...(state.payouts_enabled ? {} : { online: false }),
          updated_at: now,
        }).eq("id", driver.id);
        return json(state);
      }

      if (!accountId) {
        account = await stripe.accounts.create({
          country: "FR",
          default_currency: "eur",
          email: user.email || undefined,
          capabilities: { transfers: { requested: true } },
          controller: {
            fees: { payer: "application" },
            losses: { payments: "application" },
            stripe_dashboard: { type: "express" },
          },
          business_profile: {
            name: driver.full_name || "VASI Driver",
            support_phone: driver.phone || undefined,
          },
          metadata: { vasi_driver_id: driver.id, vasi_user_id: user.id },
        } as Stripe.AccountCreateParams);
        accountId = account.id;
        await serviceClient.from("drivers").update({
          stripe_account_id: accountId,
          stripe_details_submitted: Boolean(account.details_submitted),
          stripe_payouts_enabled: Boolean(account.payouts_enabled),
          updated_at: now,
        }).eq("id", driver.id);
      }
      await configureWeeklyMondayPayout(accountId);
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${publicUrl}/driver.html?stripe=refresh`,
        return_url: `${publicUrl}/driver.html?stripe=complete`,
        type: "account_onboarding",
      });
      return json({ connected: true, url: link.url, payout_schedule: { interval: "weekly", day: "monday" } });
    }

    if (action.startsWith("restaurant_")) {
      const { data: restaurant, error } = await userClient.from("restaurants").select("*")
        .eq("owner_id", user.id).maybeSingle();
      if (error || !restaurant) return json({ error: "Restaurant profile required" }, 404);
      if (restaurant.status !== "approved")
        return json({ error: "Restaurant must be approved before RIB onboarding" }, 403);

      if (action === "restaurant_status" || action === "restaurant_onboarding") {
        let accountId = String(restaurant.stripe_account_id || "");
        let account: Stripe.Account | null = accountId
          ? await stripe.accounts.retrieve(accountId)
          : null;
        if (account?.metadata?.vasi_restaurant_id && account.metadata.vasi_restaurant_id !== restaurant.id)
          return json({ error: "Restaurant payout account does not match" }, 409);

        if (action === "restaurant_status") {
          const state = payoutState(account);
          await serviceClient.from("restaurants").update({
            stripe_details_submitted: state.details_submitted,
            stripe_payouts_enabled: state.payouts_enabled,
            ...(state.payouts_enabled ? {} : { is_open: false }),
            updated_at: now,
          }).eq("id", restaurant.id);
          return json(state);
        }

        if (!accountId) {
          account = await stripe.accounts.create({
            country: "FR",
            default_currency: "eur",
            email: restaurant.email || user.email || undefined,
            business_type: "company",
            capabilities: { transfers: { requested: true } },
            controller: {
              fees: { payer: "application" },
              losses: { payments: "application" },
              stripe_dashboard: { type: "express" },
            },
            business_profile: {
              name: restaurant.name || restaurant.legal_name || "VASI Restaurant",
              support_phone: restaurant.phone || undefined,
            },
            metadata: { vasi_restaurant_id: restaurant.id, vasi_user_id: user.id },
          } as Stripe.AccountCreateParams);
          accountId = account.id;
          await serviceClient.from("restaurants").update({
            stripe_account_id: accountId,
            stripe_details_submitted: Boolean(account.details_submitted),
            stripe_payouts_enabled: Boolean(account.payouts_enabled),
            updated_at: now,
          }).eq("id", restaurant.id);
        }
        await configureWeeklyMondayPayout(accountId);
        const link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${publicUrl}/restaurant-dashboard.html?stripe=refresh`,
          return_url: `${publicUrl}/restaurant-dashboard.html?stripe=complete`,
          type: "account_onboarding",
        });
        return json({ connected: true, url: link.url, payout_schedule: { interval: "weekly", day: "monday" } });
      }

      let order: Record<string, any> | null = null;
      if (action === "restaurant_complete_own_delivery") {
        const { data: completed, error: completeError } = await userClient.rpc(
          "vasi_restaurant_complete_own_delivery",
          { p_order_id: String(body?.order_id || ""), p_pin: String(body?.pin || "").slice(0, 4) },
        );
        if (completeError) return json({ error: completeError.message }, 400);
        if (!completed?.ok) return json({ error: completed?.error || "Delivery could not be completed" }, 409);
        order = completed.eat;
      } else if (action === "restaurant_retry_payout") {
        const { data, error: orderError } = await userClient.from("eats_orders")
          .select("id,subtotal,delivery_fee,currency,delivery_mode,restaurant_net,status,payment_status,stripe_payment_intent_id,restaurant_payout_status,restaurant_transfer_id")
          .eq("restaurant_id", restaurant.id).eq("id", String(body?.order_id || "")).maybeSingle();
        if (orderError || !data || data.status !== "delivered" || data.payment_status !== "paid")
          return json({ error: "Only delivered paid orders can be paid out" }, 409);
        order = data;
      } else {
        return json({ error: "Unsupported action" }, 400);
      }
      return json({ order, payout: await releaseRestaurantPayout(serviceClient, restaurant, order!) });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Payout service failed" }, 500);
  }
});
