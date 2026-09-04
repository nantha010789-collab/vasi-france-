import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-07-30.basil" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  if (!signature || !Deno.env.get("STRIPE_WEBHOOK_SECRET")) return new Response("Missing signature", { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get("STRIPE_WEBHOOK_SECRET")!); }
  catch { return new Response("Invalid signature", { status: 400 }); }

  const { data: existing } = await supabase.from("vasi_payment_events").select("id").eq("provider", "stripe").eq("provider_event_id", event.id).maybeSingle();
  if (existing) return Response.json({ received: true, duplicate: true });

  const obj: any = event.data.object;
  const orderId = obj?.metadata?.order_id ?? obj?.metadata?.orderId ?? null;
  const service = obj?.metadata?.service ?? null;
  const status = event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed" ? "paid" : null;

  await supabase.from("vasi_payment_events").insert({ provider: "stripe", provider_event_id: event.id, event_type: event.type, order_id: orderId });

  if (status && orderId) {
    // Keep order dispatch behind payment confirmation. Existing order schemas are not assumed here.
    // A downstream order worker can consume this event safely using the unique provider event id.
    await supabase.from("vasi_payment_events").update({ event_type: `${event.type}:paid:${service ?? "unknown"}` }).eq("provider", "stripe").eq("provider_event_id", event.id);
  }
  return Response.json({ received: true });
});