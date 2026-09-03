import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
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
      sb
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

  if (action === "get_profile") return json({ driver: courier });
  if (action === "set_online") {
    if (!courier.verified && body.online)
      return json({ error: "Delivery driver must be verified" }, 403);
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
      sb
        .from("eats_orders")
        .select("id,restaurant_name,delivery_address,total,currency,created_at,status")
        .eq("status", "pending")
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
      const { data, error } = await sb
        .from("eats_orders")
        .update({ delivery_driver_id: courier.id, status: "accepted" })
        .eq("id", id)
        .eq("status", "pending")
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
      return json({ eat: data.eat });
    }

    const patch: Record<string, unknown> = { status };
    if (status === "picked_up") patch.picked_up_at = now;
    if (status === "delivered") patch.delivered_at = now;
    const table = action === "update_eats" ? "eats_orders" : "delivery_orders";
    const { data, error } = await sb
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
