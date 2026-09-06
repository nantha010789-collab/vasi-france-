const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const serviceKey =
  process.env.VASI_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const publicUrl = (
  process.env.VASI_PUBLIC_URL || "https://vasi-new.vercel.app"
).replace(/\/$/, "");

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

async function saveDriverPayoutState(driverId, patch) {
  const response = await sb(
    `/rest/v1/drivers?id=eq.${encodeURIComponent(driverId)}`,
    `Bearer ${serviceKey}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.message || "Driver payout account could not be saved");
    error.status = response.status;
    throw error;
  }
}

async function stripeGet(path) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Stripe request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function stripeForm(path, params, headers = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: params.toString(),
  });
  const data = await response.json();
  return { response, data };
}

async function configureWeeklyMondayPayout(accountId) {
  const params = new URLSearchParams();
  params.set("payments[payouts][schedule][interval]", "weekly");
  params.append(
    "payments[payouts][schedule][weekly_payout_days][]",
    "monday",
  );
  const { response, data } = await stripeForm(
    "/v1/balance_settings",
    params,
    { "Stripe-Account": accountId },
  );
  if (!response.ok) {
    const error = new Error(
      data?.error?.message || "Weekly payout schedule could not be configured",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

function driverCountry(value) {
  const country = String(value || "FR").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "FR";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "GET or POST required" });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseUrl || !anonKey || !stripeKey || !serviceKey)
    return res
      .status(503)
      .json({ error: "Stripe/Supabase environment is not configured" });

  try {
    const userResponse = await sb("/auth/v1/user", auth, {
      headers: { apikey: anonKey },
    });
    const user = await userResponse.json();
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const driverResponse = await sb(
      `/rest/v1/drivers?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      auth,
    );
    const drivers = await driverResponse.json();
    if (!driverResponse.ok || !drivers?.length)
      return res.status(404).json({ error: "Driver profile required" });

    const driver = drivers[0];
    if (!driver.verified)
      return res
        .status(403)
        .json({ error: "Driver must be verified before Stripe onboarding" });

    let accountId = driver.stripe_account_id;
    let account = accountId
      ? await stripeGet(`/v1/accounts/${encodeURIComponent(accountId)}`)
      : null;

    if (
      account?.metadata?.vasi_driver_id &&
      account.metadata.vasi_driver_id !== driver.id
    )
      return res.status(409).json({ error: "Driver payout account does not match" });

    if (req.method === "GET") {
      const detailsSubmitted = Boolean(account?.details_submitted);
      const payoutsEnabled = Boolean(account?.payouts_enabled);
      if (
        driver.stripe_details_submitted !== detailsSubmitted ||
        driver.stripe_payouts_enabled !== payoutsEnabled
      )
        await saveDriverPayoutState(driver.id, {
          stripe_details_submitted: detailsSubmitted,
          stripe_payouts_enabled: payoutsEnabled,
          ...(payoutsEnabled ? {} : { online: false }),
        });
      return res.status(200).json({
        connected: Boolean(accountId),
        details_submitted: detailsSubmitted,
        payouts_enabled: payoutsEnabled,
        payout_schedule: { interval: "weekly", day: "monday" },
      });
    }

    if (!accountId) {
      const params = new URLSearchParams();
      params.set("controller[fees][payer]", "application");
      params.set("controller[losses][payments]", "application");
      params.set("controller[stripe_dashboard][type]", "express");
      params.set("capabilities[transfers][requested]", "true");
      params.set("country", driverCountry(req.body?.country));
      params.set("default_currency", "eur");
      if (driver.full_name)
        params.set("business_profile[name]", driver.full_name);
      if (driver.phone)
        params.set("business_profile[support_phone]", driver.phone);
      if (user.email) params.set("email", user.email);
      params.set("metadata[vasi_driver_id]", driver.id);
      params.set("metadata[vasi_user_id]", user.id);

      const { response, data } = await stripeForm("/v1/accounts", params);
      if (!response.ok)
        return res.status(response.status).json({
          error: data?.error?.message || "Stripe account creation failed",
        });

      accountId = data.id;
      account = data;
      await saveDriverPayoutState(driver.id, {
        stripe_account_id: accountId,
        stripe_details_submitted: Boolean(account.details_submitted),
        stripe_payouts_enabled: Boolean(account.payouts_enabled),
      });
    }

    await configureWeeklyMondayPayout(accountId);

    const linkParams = new URLSearchParams();
    linkParams.set("account", accountId);
    linkParams.set(
      "refresh_url",
      `${publicUrl}/driver.html?stripe=refresh`,
    );
    linkParams.set(
      "return_url",
      `${publicUrl}/driver.html?stripe=complete`,
    );
    linkParams.set("type", "account_onboarding");

    const { response, data } = await stripeForm(
      "/v1/account_links",
      linkParams,
    );
    if (!response.ok)
      return res.status(response.status).json({
        error: data?.error?.message || "Stripe onboarding link failed",
      });

    return res.status(200).json({
      account_id: accountId,
      url: data.url,
      payout_schedule: { interval: "weekly", day: "monday" },
    });
  } catch (error) {
    return res
      .status(Number(error?.status) || 500)
      .json({ error: error?.message || "Server error" });
  }
}
