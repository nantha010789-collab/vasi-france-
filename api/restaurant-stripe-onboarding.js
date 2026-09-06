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

async function supabase(path, authorization, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function serviceDb(path, options = {}) {
  if (!serviceKey) throw Object.assign(new Error("Payout database is not configured"), { status: 503 });
  return supabase(path, `Bearer ${serviceKey}`, options);
}

async function stripe(path, { method = "GET", params, idempotencyKey } = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: params?.toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Stripe request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function saveRestaurantPayoutState(restaurantId, patch) {
  const { response, data } = await serviceDb(
    `/rest/v1/restaurants?id=eq.${encodeURIComponent(restaurantId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok)
    throw Object.assign(new Error(data?.message || "Payout account could not be saved"), {
      status: response.status,
    });
  return data?.[0] || null;
}

async function configureWeeklyMondayPayout(accountId) {
  const params = new URLSearchParams();
  params.set("payments[payouts][schedule][interval]", "weekly");
  params.append("payments[payouts][schedule][weekly_payout_days][]", "monday");
  const response = await fetch("https://api.stripe.com/v1/balance_settings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": accountId,
    },
    body: params.toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(
      new Error(data?.error?.message || "Weekly payout schedule could not be configured"),
      { status: response.status },
    );
}

function accountState(account) {
  const transferStatus =
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status;
  return {
    connected: Boolean(account?.id),
    details_submitted: Boolean(account?.details_submitted),
    payouts_enabled:
      transferStatus === "active" || Boolean(account?.payouts_enabled),
  };
}

async function edgePayout(authorization, action) {
  const response = await fetch(`${supabaseUrl}/functions/v1/provider-payout-service`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const data = await response.json().catch(() => ({ error: "Payout service unavailable" }));
  return { response, data };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "GET or POST required" });
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  if (!stripeKey || !serviceKey) {
    const { response, data } = await edgePayout(
      authorization,
      req.method === "GET" ? "restaurant_status" : "restaurant_onboarding",
    );
    return res.status(response.status).json(data);
  }

  try {
    const { response: userResponse, data: user } = await supabase(
      "/auth/v1/user",
      authorization,
    );
    if (!userResponse.ok || !user?.id)
      return res.status(401).json({ error: "Unauthorized" });

    const { response: restaurantResponse, data: restaurants } = await supabase(
      `/rest/v1/restaurants?select=id,name,legal_name,email,phone,status,stripe_account_id,stripe_details_submitted,stripe_payouts_enabled&owner_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      authorization,
    );
    if (!restaurantResponse.ok || !restaurants?.length)
      return res.status(404).json({ error: "Restaurant profile required" });

    const restaurant = restaurants[0];
    if (restaurant.status !== "approved")
      return res
        .status(403)
        .json({ error: "Restaurant must be approved before RIB onboarding" });

    let accountId = String(restaurant.stripe_account_id || "");
    let account = accountId
      ? await stripe(`/v1/accounts/${encodeURIComponent(accountId)}`)
      : null;

    if (account && account.metadata?.vasi_restaurant_id && account.metadata.vasi_restaurant_id !== restaurant.id)
      return res.status(409).json({ error: "Restaurant payout account does not match" });

    if (req.method === "GET") {
      const state = accountState(account);
      if (
        restaurant.stripe_details_submitted !== state.details_submitted ||
        restaurant.stripe_payouts_enabled !== state.payouts_enabled
      ) {
        await saveRestaurantPayoutState(restaurant.id, {
          stripe_details_submitted: state.details_submitted,
          stripe_payouts_enabled: state.payouts_enabled,
          ...(state.payouts_enabled ? {} : { is_open: false }),
        });
      }
      return res.status(200).json({
        ...state,
        payout_schedule: { interval: "weekly", day: "monday" },
      });
    }

    if (!accountId) {
      const params = new URLSearchParams();
      params.set("controller[fees][payer]", "application");
      params.set("controller[losses][payments]", "application");
      params.set("controller[stripe_dashboard][type]", "express");
      params.set("capabilities[transfers][requested]", "true");
      params.set("country", "FR");
      params.set("default_currency", "eur");
      params.set("business_type", "company");
      params.set("business_profile[name]", restaurant.name || restaurant.legal_name);
      if (restaurant.phone)
        params.set("business_profile[support_phone]", restaurant.phone);
      if (restaurant.email) params.set("email", restaurant.email);
      params.set("metadata[vasi_restaurant_id]", restaurant.id);
      params.set("metadata[vasi_user_id]", user.id);

      account = await stripe("/v1/accounts", {
        method: "POST",
        params,
        idempotencyKey: `vasi-restaurant-account-${restaurant.id}`,
      });
      accountId = account.id;
      await saveRestaurantPayoutState(restaurant.id, {
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
      `${publicUrl}/restaurant-dashboard.html?stripe=refresh`,
    );
    linkParams.set(
      "return_url",
      `${publicUrl}/restaurant-dashboard.html?stripe=complete`,
    );
    linkParams.set("type", "account_onboarding");
    const link = await stripe("/v1/account_links", {
      method: "POST",
      params: linkParams,
    });

    return res.status(200).json({
      connected: true,
      url: link.url,
      payout_schedule: { interval: "weekly", day: "monday" },
    });
  } catch (error) {
    return res
      .status(Number(error?.status) || 500)
      .json({ error: error?.message || "Restaurant payout setup failed" });
  }
}
