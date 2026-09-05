import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-07-30.basil",
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret)
    return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { data: existing } = await supabase
    .from("vasi_payment_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id)
    .maybeSingle();
  if (existing) return Response.json({ received: true, duplicate: true });

  const object: any = event.data.object;
  const orderId = object?.metadata?.order_id ?? object?.metadata?.orderId ?? null;
  const rideId = object?.metadata?.ride_id ?? object?.metadata?.rideId ?? null;
  const service = object?.metadata?.service ?? null;

  try {
    if (service === "eats" && orderId && event.type === "payment_intent.succeeded") {
      const { error } = await supabase
        .from("eats_orders")
        .update({ status: "pending", payment_status: "paid" })
        .eq("id", orderId)
        .eq("stripe_payment_intent_id", object.id)
        .in("payment_status", ["unpaid", "requires_payment"]);
      if (error) throw error;
    }

    if (rideId && event.type === "payment_intent.succeeded") {
      const { error: paymentError } = await supabase
        .from("payments")
        .update({ status: "completed", amount: Number(object.amount_received || 0) / 100 })
        .eq("ride_id", rideId)
        .eq("provider", "stripe")
        .eq("provider_payment_id", object.id);
      if (paymentError) throw paymentError;

      const { error: offsetError } = await supabase.rpc(
        "apply_ride_cash_commission_offset",
        {
          p_ride_id: rideId,
          p_stripe_payment_intent_id: object.id,
        },
      );
      if (offsetError) throw offsetError;
    }

    if (
      rideId &&
      ["payment_intent.canceled", "payment_intent.payment_failed"].includes(event.type)
    ) {
      const { error: offsetError } = await supabase.rpc(
        "release_ride_cash_commission_offset",
        { p_ride_id: rideId },
      );
      if (offsetError) throw offsetError;
    }

    if (
      service === "eats" &&
      orderId &&
      event.type === "payment_intent.payment_failed"
    ) {
      const { error } = await supabase
        .from("eats_orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId)
        .eq("stripe_payment_intent_id", object.id)
        .neq("payment_status", "paid");
      if (error) throw error;
    }

    if (event.type === "account.updated" && object?.metadata?.vasi_courier_id) {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({
          stripe_details_submitted: Boolean(object.details_submitted),
          stripe_payouts_enabled: Boolean(object.payouts_enabled),
          updated_at: new Date().toISOString(),
        })
        .eq("id", object.metadata.vasi_courier_id)
        .eq("stripe_account_id", object.id);
      if (error) throw error;
    }

    const { error: eventError } = await supabase.from("vasi_payment_events").insert({
      provider: "stripe",
      provider_event_id: event.id,
      event_type: event.type,
      order_id: orderId,
    });
    if (eventError && eventError.code !== "23505") throw eventError;
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { received: false, error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 500 },
    );
  }
});
