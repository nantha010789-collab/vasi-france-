import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const tableConfig = {
  rides: {
    service: "ride",
    statuses: {
      accepted: ["Driver accepted", "Your VASI driver is on the way.", "ride-flow.html"],
      driver_arriving: ["Driver has arrived", "Your driver is waiting at the pickup point.", "ride-flow.html"],
      in_progress: ["Ride started", "Your VASI trip is now in progress.", "ride-flow.html"],
      completed: ["Ride completed", "Your trip is complete. Your receipt is ready.", "activity.html"],
      cancelled: ["Ride cancelled", "This VASI ride has been cancelled.", "activity.html"],
    },
  },
  eats_orders: {
    service: "eats",
    statuses: {
      accepted: ["Restaurant accepted", "The restaurant accepted your order.", "activity.html"],
      preparing: ["Food is being prepared", "Your VASI Eats order is in the kitchen.", "activity.html"],
      ready_for_pickup: ["Order ready", "Your food is ready for courier pickup.", "activity.html"],
      picked_up: ["Courier picked up", "Your food is on the way.", "activity.html"],
      delivered: ["Order delivered", "Your VASI Eats order has arrived.", "activity.html"],
      cancelled: ["Order cancelled", "Your VASI Eats order was cancelled.", "activity.html"],
    },
  },
  delivery_orders: {
    service: "delivery",
    statuses: {
      accepted: ["Courier accepted", "A courier accepted your delivery.", "activity.html"],
      picked_up: ["Parcel picked up", "Your delivery is on the way.", "activity.html"],
      on_the_way: ["Courier on the way", "Your delivery is moving to the destination.", "activity.html"],
      delivered: ["Delivery complete", "Your VASI delivery has arrived.", "activity.html"],
      cancelled: ["Delivery cancelled", "Your VASI delivery was cancelled.", "activity.html"],
    },
  },
} as const;

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1)
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return Response.json({ ok: false }, { status: 405 });

  const body = await req.json().catch(() => ({}));
  const table = String(body?.table || "") as keyof typeof tableConfig;
  const eventType = String(body?.event || "status");
  const id = String(body?.record?.id || "");
  const requestedStatus = String(body?.record?.status || "").toLowerCase();
  const config = tableConfig[table];
  if (!config || !id || !requestedStatus)
    return Response.json({ ok: false }, { status: 400 });

  const { data: credentials, error: credentialsError } = await supabase
    .rpc("get_vasi_push_credentials")
    .single();
  if (
    credentialsError ||
    !credentials?.public_key ||
    !credentials?.private_key ||
    !credentials?.subject ||
    !credentials?.hook_secret ||
    !safeEqual(req.headers.get("x-vasi-hook-secret") || "", credentials.hook_secret)
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const { data: current, error: rowError } = eventType === "flight"
    ? await supabase.from("rides").select("id,customer_id,driver_id,status,flight_number,flight_status,flight_timing,flight_delay_minutes,scheduled_for,flight_arrival_terminal,flight_arrival_gate").eq("id", id).maybeSingle()
    : await supabase.from(table).select("id,customer_id,status").eq("id", id).maybeSingle();

  if (eventType === "flight") {
    if (rowError || !current?.customer_id || !current?.flight_number)
      return Response.json({ ok: true, ignored: true }, { status: 202 });

    const flightStatus = String(current.flight_status || "unknown").toLowerCase();
    const timing = String(current.flight_timing || "unknown").toLowerCase();
    const delay = Number(current.flight_delay_minutes || 0);
    const pickup = current.scheduled_for ? new Date(current.scheduled_for) : null;
    const pickupText = pickup && Number.isFinite(pickup.getTime())
      ? pickup.toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "the confirmed time";
    const place = [current.flight_arrival_terminal ? `Terminal ${current.flight_arrival_terminal}` : "", current.flight_arrival_gate ? `Gate ${current.flight_arrival_gate}` : ""].filter(Boolean).join(" · ");
    let title = `Flight ${current.flight_number} update`;
    let message = `Pickup is scheduled for ${pickupText}.`;
    if (flightStatus === "landed") {
      title = `Flight ${current.flight_number} has landed`;
      message = `${place ? place + ". " : ""}Pickup is scheduled for ${pickupText}.`;
    } else if (flightStatus === "cancelled") {
      title = `Flight ${current.flight_number} cancelled`;
      message = "Open VASI to review or cancel the airport pickup.";
    } else if (timing === "delayed") {
      title = `Flight ${current.flight_number} delayed`;
      message = `${delay > 0 ? `About ${delay} minutes late. ` : ""}Pickup moved automatically to ${pickupText}.`;
    } else if (timing === "early") {
      title = `Flight ${current.flight_number} arriving early`;
      message = `Pickup moved automatically to ${pickupText}.`;
    } else if (flightStatus === "active") {
      title = `Flight ${current.flight_number} is in the air`;
    }

    const delayBand = Math.round(delay / 15) * 15;
    const pickupBand = pickup ? Math.round(pickup.getTime() / 900_000) : 0;
    const recipients: Array<{ id: string; role: string; url: string }> = [
      { id: current.customer_id, role: "customer", url: "ride-flow.html" },
    ];
    if (current.driver_id) {
      const { data: driver } = await supabase.from("drivers").select("user_id").eq("id", current.driver_id).maybeSingle();
      if (driver?.user_id) recipients.push({ id: driver.user_id, role: "driver", url: "driver.html" });
    }

    webpush.setVapidDetails(credentials.subject, credentials.public_key, credentials.private_key);
    let attempted = 0;
    let sent = 0;
    for (const recipient of recipients) {
      const eventKey = `flight:${id}:${recipient.role}:${flightStatus}:${timing}:${delayBand}:${pickupBand}`;
      const { data: event, error: eventError } = await supabase.from("push_notification_events").insert({
        event_key: eventKey,
        customer_id: recipient.id,
        service: "ride",
        entity_id: id,
        status: `flight_${flightStatus}_${timing}`.slice(0, 80),
      }).select("id").single();
      if (eventError?.code === "23505") continue;
      if (eventError || !event) continue;
      const { data: subscriptions } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", recipient.id).eq("active", true);
      let recipientSent = 0;
      for (const subscription of subscriptions || []) {
        attempted += 1;
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({
            title,
            body: recipient.role === "driver" ? `Passenger flight update. ${message}` : message,
            icon: "vasi-word-icon-192.png",
            badge: "vasi-word-icon-192.png",
            tag: `vasi-${eventKey.replaceAll(":", "-")}`,
            url: recipient.url,
          }), { TTL: 600, urgency: "high" });
          sent += 1;
          recipientSent += 1;
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
          if (statusCode === 404 || statusCode === 410)
            await supabase.from("push_subscriptions").update({ active: false }).eq("id", subscription.id);
        }
      }
      await supabase.from("push_notification_events").update({
        delivery_status: !subscriptions?.length ? "no_subscriptions" : recipientSent === subscriptions.length ? "sent" : recipientSent > 0 ? "partial" : "failed",
        attempted_count: subscriptions?.length || 0,
        sent_count: recipientSent,
        completed_at: new Date().toISOString(),
      }).eq("id", event.id);
    }
    return Response.json({ ok: true, recipients: recipients.length, attempted, sent });
  }

  const status = String(current?.status || "").toLowerCase();
  const copy = (config.statuses as Record<string, readonly [string, string, string]>)[status];
  if (rowError || !current?.customer_id || status !== requestedStatus || !copy)
    return Response.json({ ok: true, ignored: true }, { status: 202 });

  const eventKey = `${config.service}:${id}:${status}`;
  const { data: event, error: eventError } = await supabase
    .from("push_notification_events")
    .insert({
      event_key: eventKey,
      customer_id: current.customer_id,
      service: config.service,
      entity_id: id,
      status,
    })
    .select("id")
    .single();
  if (eventError?.code === "23505")
    return Response.json({ ok: true, duplicate: true });
  if (eventError || !event)
    return Response.json({ ok: false }, { status: 500 });

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth_key")
    .eq("user_id", current.customer_id)
    .eq("active", true);

  if (subscriptionError) {
    await supabase.from("push_notification_events").update({
      delivery_status: "failed",
      completed_at: new Date().toISOString(),
    }).eq("id", event.id);
    return Response.json({ ok: false }, { status: 500 });
  }

  if (!subscriptions?.length) {
    await supabase.from("push_notification_events").update({
      delivery_status: "no_subscriptions",
      completed_at: new Date().toISOString(),
    }).eq("id", event.id);
    return Response.json({ ok: true, attempted: 0, sent: 0 });
  }

  webpush.setVapidDetails(
    credentials.subject,
    credentials.public_key,
    credentials.private_key,
  );

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_key,
          },
        },
        JSON.stringify({
          title: copy[0],
          body: copy[1],
          icon: "vasi-word-icon-192.png",
          badge: "vasi-word-icon-192.png",
          tag: `vasi-${eventKey.replaceAll(":", "-")}`,
          url: copy[2],
        }),
        { TTL: 300, urgency: "high" },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410)
        await supabase.from("push_subscriptions").update({ active: false }).eq("id", subscription.id);
    }
  }

  const deliveryStatus =
    sent === subscriptions.length ? "sent" : sent > 0 ? "partial" : "failed";
  await supabase.from("push_notification_events").update({
    delivery_status: deliveryStatus,
    attempted_count: subscriptions.length,
    sent_count: sent,
    completed_at: new Date().toISOString(),
  }).eq("id", event.id);

  return Response.json({ ok: true, attempted: subscriptions.length, sent });
});
