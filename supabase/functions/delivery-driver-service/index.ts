import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

const money = (value: unknown) => Math.round(Number(value || 0) * 100);

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
  params.append(
    "payments[payouts][schedule][weekly_payout_days][]",
    "monday",
  );
  const response = await fetch("https://api.stripe.com/v1/balance_settings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": accountId,
    },
    body: params.toString(),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data?.error?.message || "Weekly payout schedule could not be configured",
    );
  return data;
}

async function releaseEatsCourierPayout(
  serviceClient: ReturnType<typeof createClient>,
  courier: Record<string, unknown>,
  orderId: string,
) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return { status: "pending", message: "Payout is queued" };

  const { data: order, error: orderError } = await serviceClient
    .from("eats_orders")
    .select(
      "id,currency,courier_offer_amount,courier_payout_status,courier_transfer_id,stripe_payment_intent_id,delivery_driver_id",
    )
    .eq("id", orderId)
    .single();
  if (orderError || !order) throw orderError ?? new Error("Order not found");
  if (order.delivery_driver_id !== courier.id) throw new Error("Courier assignment mismatch");
  if (order.courier_transfer_id)
    return { status: "paid", transfer_id: order.courier_transfer_id };

  const accountId = String(courier.stripe_account_id || "");
  if (!accountId) {
    await serviceClient
      .from("eats_orders")
      .update({ courier_payout_status: "requires_onboarding" })
      .eq("id", orderId);
    await serviceClient
      .from("courier_eats_earnings")
      .update({ status: "requires_onboarding", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { status: "requires_onboarding", message: "Connect your RIB to receive this earning" };
  }

  const stripe = stripeClient();
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (
      account.metadata?.vasi_courier_id !== courier.id ||
      !account.details_submitted ||
      !account.payouts_enabled
    ) {
      await serviceClient
        .from("eats_orders")
        .update({ courier_payout_status: "requires_onboarding" })
        .eq("id", orderId);
      await serviceClient
        .from("courier_eats_earnings")
        .update({ status: "requires_onboarding", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return { status: "requires_onboarding", message: "Finish RIB verification to receive this earning" };
    }

    const paymentIntentId = String(order.stripe_payment_intent_id || "");
    if (!paymentIntentId) throw new Error("Paid order has no payment reference");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId = typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;
    if (paymentIntent.status !== "succeeded" || !chargeId)
      throw new Error("Customer payment is not settled");

    const amount = money(order.courier_offer_amount);
    if (amount < 400) throw new Error("Courier protection amount is invalid");
    const transfer = await stripe.transfers.create(
      {
        amount,
        currency: String(order.currency || "eur").toLowerCase(),
        destination: accountId,
        source_transaction: chargeId,
        transfer_group: `VASI_EATS_${orderId}`,
        metadata: {
          vasi_service: "eats",
          vasi_order_id: orderId,
          vasi_courier_id: String(courier.id),
        },
      },
      { idempotencyKey: `vasi-eats-courier-${orderId}` },
    );
    const paidAt = new Date().toISOString();
    await serviceClient
      .from("eats_orders")
      .update({
        courier_payout_status: "paid",
        courier_transfer_id: transfer.id,
        courier_paid_at: paidAt,
      })
      .eq("id", orderId);
    await serviceClient
      .from("courier_eats_earnings")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        paid_at: paidAt,
        updated_at: paidAt,
      })
      .eq("order_id", orderId);
    return { status: "paid", amount: amount / 100, currency: order.currency, transfer_id: transfer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout could not be released";
    await serviceClient
      .from("eats_orders")
      .update({ courier_payout_status: "failed" })
      .eq("id", orderId);
    await serviceClient
      .from("courier_eats_earnings")
      .update({ status: "failed", failure_reason: message, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { status: "failed", message: "Delivery is complete; payout needs review" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "").trim();
  if (!action) return json({ error: "Missing action" }, 400);
  const now = new Date().toISOString();

  const { data: courier, error: courierError } = await sb
    .from("delivery_drivers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (courierError) return json({ error: "Could not load courier profile" }, 400);
  if (!courier) return json({ error: "Delivery driver profile required" }, 403);

  const orderId = () => {
    const id = String(body?.order_id || "").trim();
    return id && id.length <= 128 ? id : "";
  };
  const currentJobs = async () => {
    const [eats, delivery] = await Promise.all([
      serviceClient
        .from("eats_orders")
        .select("*")
        .eq("delivery_driver_id", courier.id)
        .in("status", ["accepted", "picked_up"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("delivery_orders")
        .select("*")
        .eq("delivery_driver_id", courier.id)
        .in("status", ["accepted", "picked_up"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (eats.error) throw eats.error;
    if (delivery.error) throw delivery.error;
    return { eat: eats.data ?? null, delivery: delivery.data ?? null };
  };

  if (action === "get_profile") {
    const { data: earnings } = await sb
      .from("courier_eats_earnings")
      .select("amount,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return json({ driver: courier, earnings: earnings ?? [] });
  }
  if (action === "set_online") {
    if (!courier.verified && body.online)
      return json({ error: "Delivery driver must be verified" }, 403);
    if (
      body.online &&
      (!courier.stripe_account_id || !courier.stripe_payouts_enabled)
    )
      return json(
        {
          error:
            "Connect and verify your bank account (RIB) before going online",
        },
        403,
      );
    if (body.online) {
      const jobs = await currentJobs().catch(() => ({ eat: null, delivery: null }));
      if (jobs.eat || jobs.delivery)
        return json(
          { error: "Finish your active courier job before going online for new jobs" },
          409,
        );
    }
    const { data, error } = await sb
      .from("delivery_drivers")
      .update({ online: !!body.online, updated_at: now })
      .eq("id", courier.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ driver: data });
  }
  if (action === "update_location") {
    const lat = Number(body.latitude),
      lng = Number(body.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    )
      return json({ error: "Valid latitude and longitude required" }, 400);
    const { data, error } = await sb
      .from("delivery_drivers")
      .update({ latitude: lat, longitude: lng, updated_at: now })
      .eq("id", courier.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ driver: data });
  }
  if (action === "get_current_jobs") {
    try {
      return json(await currentJobs());
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Could not load current jobs" },
        400,
      );
    }
  }

  if (!courier.verified)
    return json({ error: "Delivery driver must be verified" }, 403);

  if (action === "get_payout_account" || action === "create_payout_onboarding") {
    try {
      const stripe = stripeClient();
      let accountId = String(courier.stripe_account_id || "");
      let account: Stripe.Account | null = null;
      if (accountId) {
        account = await stripe.accounts.retrieve(accountId);
        if (account.metadata?.vasi_courier_id !== courier.id)
          return json({ error: "Courier payout account does not match" }, 409);
      }

      if (action === "get_payout_account") {
        const detailsSubmitted = Boolean(account?.details_submitted);
        const payoutsEnabled = Boolean(account?.payouts_enabled);
        if (
          courier.stripe_details_submitted !== detailsSubmitted ||
          courier.stripe_payouts_enabled !== payoutsEnabled
        ) {
          await serviceClient
            .from("delivery_drivers")
            .update({
              stripe_details_submitted: detailsSubmitted,
              stripe_payouts_enabled: payoutsEnabled,
              updated_at: now,
            })
            .eq("id", courier.id);
        }
        return json({
          connected: Boolean(accountId),
          details_submitted: detailsSubmitted,
          payouts_enabled: payoutsEnabled,
        });
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
            name: courier.full_name || "VASI Courier",
            support_phone: courier.phone || undefined,
          },
          metadata: {
            vasi_courier_id: courier.id,
            vasi_user_id: user.id,
          },
        } as Stripe.AccountCreateParams);
        accountId = account.id;
        const { error: linkError } = await serviceClient
          .from("delivery_drivers")
          .update({ stripe_account_id: accountId, updated_at: now })
          .eq("id", courier.id);
        if (linkError)
          return json({ error: "Payout account was created but could not be linked" }, 500);
      }

      await configureWeeklyMondayPayout(accountId);

      const publicUrl = Deno.env.get("VASI_PUBLIC_URL") || "https://vasi-new.vercel.app";
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${publicUrl}/delivery-driver.html?stripe=refresh`,
        return_url: `${publicUrl}/delivery-driver.html?stripe=complete`,
        type: "account_onboarding",
      });
      return json({
        connected: true,
        url: link.url,
        payout_schedule: { interval: "weekly", day: "monday" },
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Payout setup failed" },
        500,
      );
    }
  }

  if (action === "get_available_jobs") {
    if (!courier.online)
      return json({ error: "Go online to see available courier jobs" }, 403);
    try {
      const jobs = await currentJobs();
      if (jobs.eat || jobs.delivery)
        return json({
          eats: [],
          deliveries: [],
          active_job: jobs.eat
            ? { type: "eats", job: jobs.eat }
            : { type: "delivery", job: jobs.delivery },
        });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Could not verify active jobs" },
        400,
      );
    }
    const [eats, deliveries] = await Promise.all([
      serviceClient
        .from("eats_orders")
        .select(
          "id,restaurant_name,delivery_address,courier_offer_amount,delivery_distance_km,estimated_delivery_minutes,currency,created_at,status,payment_status",
        )
        .eq("status", "pending")
        .eq("payment_status", "paid")
        .eq("delivery_mode", "vasi")
        .is("delivery_driver_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("delivery_orders")
        .select("id,pickup_address,dropoff_address,item_type,quote,currency,created_at,status")
        .eq("status", "pending")
        .is("delivery_driver_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (eats.error) return json({ error: eats.error.message }, 400);
    if (deliveries.error) return json({ error: deliveries.error.message }, 400);
    return json({ eats: eats.data ?? [], deliveries: deliveries.data ?? [] });
  }

  if (action === "accept_eats" || action === "accept_delivery") {
    if (!courier.online)
      return json({ error: "Go online before accepting a courier job" }, 403);
    const id = orderId();
    if (!id) return json({ error: "Valid order_id required" }, 400);
    try {
      const jobs = await currentJobs();
      if (jobs.eat || jobs.delivery)
        return json({ error: "Finish your current courier job before accepting another" }, 409);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Could not verify active jobs" },
        400,
      );
    }

    if (action === "accept_eats") {
      const { data, error } = await serviceClient
        .from("eats_orders")
        .update({ delivery_driver_id: courier.id, status: "accepted", accepted_at: now })
        .eq("id", id)
        .eq("status", "pending")
        .eq("payment_status", "paid")
        .eq("delivery_mode", "vasi")
        .is("delivery_driver_id", null)
        .select()
        .single();
      if (error || !data)
        return json({ error: error?.message ?? "Food order is no longer available" }, 409);
      await sb
        .from("delivery_drivers")
        .update({ online: false, updated_at: now })
        .eq("id", courier.id);
      return json({ eat: data });
    }

    const { data, error } = await sb
      .from("delivery_orders")
      .update({ delivery_driver_id: courier.id, status: "accepted" })
      .eq("id", id)
      .eq("status", "pending")
      .is("delivery_driver_id", null)
      .select()
      .single();
    if (error || !data)
      return json({ error: error?.message ?? "Delivery is no longer available" }, 409);
    await sb
      .from("delivery_drivers")
      .update({ online: false, updated_at: now })
      .eq("id", courier.id);
    return json({ delivery: data });
  }

  if (action === "update_eats" || action === "update_delivery") {
    const id = orderId();
    if (!id) return json({ error: "Valid order_id required" }, 400);
    const status = String(body.status || "");
    if (!["picked_up", "delivered"].includes(status))
      return json(
        { error: action === "update_eats" ? "Invalid food order status" : "Invalid delivery status" },
        400,
      );

    if (action === "update_eats" && status === "delivered") {
      const { data, error } = await sb.rpc("vasi_courier_complete_eats_order", {
        p_order_id: id,
        p_pin: String(body.pin || ""),
      });
      if (error) return json({ error: error.message }, 400);
      if (!data?.ok) return json({ error: data?.error || "Delivery PIN could not be verified" }, 409);
      const payout = await releaseEatsCourierPayout(serviceClient, courier, id);
      return json({ eat: data.eat, payout });
    }

    const patch: Record<string, unknown> = { status };
    if (status === "picked_up") patch.picked_up_at = now;
    if (status === "delivered") patch.delivered_at = now;
    const table = action === "update_eats" ? "eats_orders" : "delivery_orders";
    const orderClient = action === "update_eats" ? serviceClient : sb;
    const { data, error } = await orderClient
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("delivery_driver_id", courier.id)
      .eq("status", status === "picked_up" ? "accepted" : "picked_up")
      .select()
      .single();
    if (error || !data)
      return json({ error: error?.message ?? "Courier job cannot be updated" }, 409);
    if (status === "delivered")
      await sb
        .from("delivery_drivers")
        .update({ online: false, updated_at: now })
        .eq("id", courier.id);
    return json(action === "update_eats" ? { eat: data } : { delivery: data });
  }

  return json({ error: "Unknown action" }, 400);
});
