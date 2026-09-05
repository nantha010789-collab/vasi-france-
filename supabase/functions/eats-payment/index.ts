import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-07-30.basil",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store, max-age=0",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  if (!Deno.env.get("STRIPE_SECRET_KEY"))
    return json({ error: "Card payment is not configured" }, 503);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "create");
  const orderId = String(body?.order_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId))
    return json({ error: "Valid order required" }, 400);

  const { data: order, error: orderError } = await userClient
    .from("eats_orders")
    .select(
      "id,customer_id,total,currency,status,payment_status,stripe_payment_intent_id",
    )
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (orderError || !order) return json({ error: "Order not found" }, 404);

  try {
    if (action === "create") {
      if (order.payment_status === "paid")
        return json({ paid: true, order_id: order.id });
      if (order.status !== "awaiting_payment")
        return json({ error: "Order is not waiting for payment" }, 409);

      let paymentIntent: Stripe.PaymentIntent | null = null;
      if (order.stripe_payment_intent_id) {
        paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripe_payment_intent_id,
        );
        if (["canceled", "succeeded"].includes(paymentIntent.status))
          paymentIntent = null;
      }
      if (!paymentIntent) {
        const amount = Math.round(Number(order.total || 0) * 100);
        if (!Number.isFinite(amount) || amount < 50)
          return json({ error: "Order total is too low for card payment" }, 400);
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount,
            currency: String(order.currency || "eur").toLowerCase(),
            automatic_payment_methods: { enabled: true, allow_redirects: "never" },
            description: `VASI Eats order ${order.id}`,
            metadata: {
              service: "eats",
              order_id: order.id,
              customer_id: user.id,
            },
          },
          { idempotencyKey: `vasi-eats-payment-${order.id}` },
        );
        const { error: saveError } = await serviceClient
          .from("eats_orders")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: "requires_payment",
          })
          .eq("id", order.id)
          .eq("customer_id", user.id);
        if (saveError)
          return json({ error: "Payment was prepared but could not be attached to the order" }, 500);
      }
      return json({
        order_id: order.id,
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: Number(order.total),
        currency: order.currency || "EUR",
      });
    }

    if (action === "confirm") {
      if (!order.stripe_payment_intent_id)
        return json({ error: "Payment has not been started" }, 409);
      const paymentIntent = await stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id,
      );
      if (
        paymentIntent.metadata?.service !== "eats" ||
        paymentIntent.metadata?.order_id !== order.id ||
        paymentIntent.metadata?.customer_id !== user.id
      ) {
        return json({ error: "Payment does not match this order" }, 409);
      }
      if (paymentIntent.status !== "succeeded")
        return json({ paid: false, payment_status: paymentIntent.status }, 409);

      const { error: paidError } = await serviceClient
        .from("eats_orders")
        .update({ status: "pending", payment_status: "paid" })
        .eq("id", order.id)
        .eq("customer_id", user.id)
        .in("payment_status", ["unpaid", "requires_payment"]);
      if (paidError) return json({ error: "Payment succeeded; order confirmation is pending" }, 500);
      const { data: safety } = await serviceClient
        .from("eats_order_safety")
        .select("delivery_pin")
        .eq("order_id", order.id)
        .maybeSingle();
      return json({
        paid: true,
        order_id: order.id,
        payment_status: paymentIntent.status,
        delivery_pin: safety?.delivery_pin || null,
      });
    }

    return json({ error: "Unsupported payment action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Payment failed" }, 500);
  }
});
