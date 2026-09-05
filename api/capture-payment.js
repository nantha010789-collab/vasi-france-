const supabaseUrl =
  process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;

async function sb(path, auth, options = {}) {
  return fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: auth,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function reserveCashCommissionOffset(rideId, auth) {
  const response = await sb(
    "/rest/v1/rpc/reserve_ride_cash_commission_offset",
    auth,
    {
    method: "POST",
      body: JSON.stringify({ p_ride_id: rideId }),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Cash commission balance could not be updated",
    );
  }
  return data || { amount: 0, status: "none" };
}

function rideCommissionPercent(ride) {
  const stored = Number(ride.commission_percent);
  if (Number.isFinite(stored) && stored >= 0 && stored <= 50) return stored;
  const estimatedFare = Number(ride.estimated_fare || 0);
  const storedFee = Number(ride.vasi_commission || 0);
  if (estimatedFare > 0 && storedFee >= 0)
    return Math.min(50, (storedFee / estimatedFare) * 100);
  return 15;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseUrl || !anonKey || !stripeKey)
    return res
      .status(503)
      .json({ error: "Payment service is not configured" });

  try {
    const id = String(req.body?.ride_id || "");
    if (!id) return res.status(400).json({ error: "ride_id required" });

    const rideResponse = await sb(
      `/rest/v1/rides?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
      auth,
    );
    const rides = await rideResponse.json();
    if (!rideResponse.ok || !rides?.length)
      return res.status(404).json({ error: "Ride not found" });
    const ride = rides[0];

    const userResponse = await sb("/auth/v1/user", auth, {
      headers: { apikey: anonKey },
    });
    const user = await userResponse.json();
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const customerOwns = ride.customer_id === user.id;
    let driverOwns = false;
    if (ride.driver_id) {
      const driverResponse = await sb(
        `/rest/v1/drivers?select=id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
        auth,
      );
      const drivers = await driverResponse.json();
      driverOwns = Boolean(
        drivers?.length && drivers[0].id === ride.driver_id,
      );
    }

    let fare = 0;
    let kind = "ride";
    if (customerOwns && String(ride.status) === "cancelled") {
      fare = Number(ride.cancellation_fee ?? ride.final_fare ?? 0);
      kind = "cancellation";
    } else if (driverOwns && String(ride.status) === "completed") {
      fare = Number(ride.final_fare ?? ride.estimated_fare ?? 0);
    } else {
      return res
        .status(403)
        .json({ error: "Payment capture not authorized for this ride state" });
    }

    if (!Number.isFinite(fare) || fare < 0)
      return res.status(400).json({ error: "Invalid server-side fare" });
    if (fare === 0)
      return res
        .status(200)
        .json({ ok: true, status: "not_charged", amount: 0, kind });
    if (String(ride.payment_method || "cash").toLowerCase() === "cash")
      return res
        .status(200)
        .json({ ok: true, status: "cash", amount: fare, kind });

    const paymentResponse = await sb(
      `/rest/v1/payments?select=*&ride_id=eq.${encodeURIComponent(id)}&provider=eq.stripe&limit=1`,
      auth,
    );
    const payments = await paymentResponse.json();
    if (!paymentResponse.ok || !payments?.length)
      return res.status(404).json({ error: "Stripe payment not found" });
    const payment = payments[0];
    const intent = payment.provider_payment_id;
    if (!intent)
      return res.status(400).json({ error: "Stripe payment intent missing" });

    const intentResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intent)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const paymentIntent = await intentResponse.json();
    if (!intentResponse.ok)
      return res
        .status(intentResponse.status)
        .json({ error: paymentIntent?.error?.message || "Stripe lookup failed" });
    if (paymentIntent.status === "succeeded") {
      return res.status(200).json({
        ok: true,
        status: "succeeded",
        amount: Number(payment.amount || fare),
        kind,
        already_captured: true,
      });
    }
    if (paymentIntent.status !== "requires_capture")
      return res.status(409).json({
        error: "Payment is not available for capture",
        payment_status: paymentIntent.status,
      });

    const authorized = Number(paymentIntent.amount || 0);
    const captureAmount = Math.round(fare * 100);
    if (captureAmount > authorized)
      return res.status(409).json({
        error:
          "Final fare exceeds the authorized card amount; additional customer authorization is required",
        authorized_amount: authorized / 100,
      });

    const commissionPercent = rideCommissionPercent(ride);
    const rideCommission = Math.max(
      0,
      Math.min(
        captureAmount,
        Math.round((captureAmount * commissionPercent) / 100),
      ),
    );
    const reservedOffset = await reserveCashCommissionOffset(id, auth);
    const cashDebtOffset = Math.max(
      0,
      Math.min(
        captureAmount - rideCommission,
        Math.round(Number(reservedOffset.amount || 0) * 100),
      ),
    );
    const applicationFee = rideCommission + cashDebtOffset;
    const captureParams = new URLSearchParams({
      amount_to_capture: String(captureAmount),
    });
    if (applicationFee > 0)
      captureParams.set("application_fee_amount", String(applicationFee));

    const captureResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intent)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `vasi-ride-capture-${id}`,
        },
        body: captureParams.toString(),
      },
    );
    const captured = await captureResponse.json();
    if (!captureResponse.ok) {
      return res
        .status(captureResponse.status)
        .json({ error: captured?.error?.message || "Capture failed" });
    }

    await sb(`/rest/v1/payments?id=eq.${encodeURIComponent(payment.id)}`, auth, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        amount: fare,
        status: captured.status === "succeeded" ? "completed" : "pending",
      }),
    });
    return res.status(200).json({
      ok: true,
      status: captured.status,
      amount: fare,
      kind,
      commission_percent: commissionPercent,
      vasi_commission: rideCommission / 100,
      driver_amount: (captureAmount - rideCommission) / 100,
      cash_commission_debt_deducted: cashDebtOffset / 100,
      bank_payout_credit: (captureAmount - applicationFee) / 100,
      cash_commission_status: "pending_stripe_confirmation",
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Server error" });
  }
}
