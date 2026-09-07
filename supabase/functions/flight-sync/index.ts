import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Ride = {
  id: string;
  status: string;
  flight_number: string;
  flight_status: string | null;
  scheduled_for: string;
  flight_booked_pickup_at: string | null;
  flight_status_checked_at: string | null;
  flight_pickup_buffer_minutes: number | null;
};

type ProviderFlight = {
  flight_status?: string;
  flight?: { iata?: string };
  arrival?: {
    airport?: string;
    terminal?: string;
    gate?: string;
    baggage?: string;
    delay?: number;
    scheduled?: string;
    estimated?: string;
    actual?: string;
  };
};

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1)
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function timestamp(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

function isDue(ride: Ride, now: number) {
  if (["landed", "cancelled", "incident", "diverted"].includes(String(ride.flight_status || "").toLowerCase())) return false;
  const target = timestamp(ride.flight_booked_pickup_at || ride.scheduled_for) || now;
  const hours = (target - now) / 3_600_000;
  const interval = hours > 12 ? 6 * 3_600_000 : hours > 3 ? 2 * 3_600_000 : hours > 1 ? 30 * 60_000 : 10 * 60_000;
  const checked = timestamp(ride.flight_status_checked_at);
  return checked === null || now - checked >= interval;
}

function chooseFlight(flights: ProviderFlight[], ride: Ride) {
  const target = timestamp(ride.flight_booked_pickup_at || ride.scheduled_for) || Date.now();
  return flights
    .filter((item) => String(item?.flight?.iata || "").replace(/\s/g, "").toUpperCase() === ride.flight_number.replace(/\s/g, "").toUpperCase())
    .sort((left, right) => {
      const leftTime = timestamp(left.arrival?.estimated || left.arrival?.scheduled) ?? Number.MAX_SAFE_INTEGER;
      const rightTime = timestamp(right.arrival?.estimated || right.arrival?.scheduled) ?? Number.MAX_SAFE_INTEGER;
      return Math.abs(leftTime - target) - Math.abs(rightTime - target);
    })[0] || null;
}

function normalStatus(value?: string) {
  const status = String(value || "unknown").toLowerCase();
  return ["scheduled", "active", "landed", "cancelled", "incident", "diverted"].includes(status) ? status : "unknown";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ ok: false }, { status: 405 });

  const { data: credentials, error: credentialsError } = await supabase
    .rpc("get_vasi_flight_sync_credentials")
    .single();
  if (
    credentialsError ||
    !credentials?.api_key ||
    !credentials?.hook_secret ||
    !safeEqual(req.headers.get("x-vasi-hook-secret") || "", credentials.hook_secret)
  ) return Response.json({ ok: false }, { status: 401 });

  const now = Date.now();
  const lower = new Date(now - 6 * 3_600_000).toISOString();
  const upper = new Date(now + 36 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("rides")
    .select("id,status,flight_number,flight_status,scheduled_for,flight_booked_pickup_at,flight_status_checked_at,flight_pickup_buffer_minutes")
    .eq("airport_pickup", true)
    .not("flight_number", "is", null)
    .in("status", ["requested", "accepted", "driver_arriving"])
    .gte("scheduled_for", lower)
    .lte("scheduled_for", upper)
    .order("scheduled_for", { ascending: true })
    .limit(20);
  if (error) return Response.json({ ok: false, error: "rides_unavailable" }, { status: 500 });

  const terminal = new Set(["landed", "cancelled", "incident", "diverted"]);
  const rides = ((data || []) as Ride[]).filter((ride) => isDue(ride, now)).slice(0, 5);
  let updated = 0;
  let notFound = 0;
  let failed = 0;

  for (const ride of rides) {
    try {
      const url = new URL("https://api.aviationstack.com/v1/flights");
      url.searchParams.set("access_key", credentials.api_key);
      url.searchParams.set("flight_iata", ride.flight_number.replace(/\s/g, ""));
      url.searchParams.set("limit", "10");
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok || payload?.error) throw new Error("provider_error");
      const flight = chooseFlight(Array.isArray(payload?.data) ? payload.data : [], ride);
      if (!flight) {
        notFound += 1;
        await supabase.from("rides").update({
          flight_status: "not_found",
          flight_status_checked_at: new Date().toISOString(),
          flight_tracking_error: "Flight not found. Check the flight number and arrival date.",
        }).eq("id", ride.id);
        continue;
      }

      const arrival = flight.arrival || {};
      const scheduledAt = timestamp(arrival.scheduled);
      const estimatedAt = timestamp(arrival.estimated);
      const actualAt = timestamp(arrival.actual);
      const delayMinutes = Number.isFinite(Number(arrival.delay))
        ? Math.round(Number(arrival.delay))
        : scheduledAt && estimatedAt ? Math.round((estimatedAt - scheduledAt) / 60_000) : 0;
      const timing = delayMinutes >= 10 ? "delayed" : delayMinutes <= -10 ? "early" : "on_time";
      const providerStatus = normalStatus(flight.flight_status);
      const bestArrival = actualAt || estimatedAt || scheduledAt;
      const bufferMinutes = Math.max(0, Math.min(180, Number(ride.flight_pickup_buffer_minutes ?? 30)));
      const pickupAt = bestArrival ? new Date(bestArrival + bufferMinutes * 60_000).toISOString() : ride.scheduled_for;
      const update: Record<string, unknown> = {
        flight_status: providerStatus,
        flight_status_checked_at: new Date().toISOString(),
        flight_scheduled_arrival_at: arrival.scheduled || null,
        flight_estimated_arrival_at: arrival.estimated || null,
        flight_actual_arrival_at: arrival.actual || null,
        flight_arrival_airport: arrival.airport || null,
        flight_arrival_terminal: arrival.terminal || null,
        flight_arrival_gate: arrival.gate || null,
        flight_arrival_baggage: arrival.baggage || null,
        flight_delay_minutes: delayMinutes,
        flight_timing: timing,
        flight_tracking_error: null,
      };
      if (!ride.flight_booked_pickup_at) update.flight_booked_pickup_at = ride.scheduled_for;
      if (ride.status !== "driver_arriving" && Math.abs((timestamp(pickupAt) || 0) - (timestamp(ride.scheduled_for) || 0)) > 120_000)
        update.scheduled_for = pickupAt;
      const { error: updateError } = await supabase.from("rides").update(update).eq("id", ride.id);
      if (updateError) throw new Error("update_failed");
      updated += 1;
      if (terminal.has(providerStatus)) continue;
    } catch (_) {
      failed += 1;
      await supabase.from("rides").update({
        flight_status_checked_at: new Date().toISOString(),
        flight_tracking_error: "Live flight tracking is temporarily unavailable.",
      }).eq("id", ride.id);
    }
  }

  return Response.json({ ok: true, scanned: data?.length || 0, checked: rides.length, updated, not_found: notFound, failed });
});
