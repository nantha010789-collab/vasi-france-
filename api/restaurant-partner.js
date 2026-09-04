const url =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const key =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const serviceKey =
  process.env.VASI_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";
const PHOTO_BUCKET = "restaurant-menu-photos";
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const clean = (value, length = 160) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, length);
let auth = "";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function db(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: auth,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw httpError(response.status, data?.message || "Database request failed");
  return data;
}

async function rpc(name, body) {
  return db(`rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function user(req) {
  auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: auth },
  });
  if (!response.ok) return null;
  const account = await response.json();
  return account?.id ? account : null;
}

function imagePayload(value) {
  const match = String(value || "").match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) throw httpError(400, "Choose a JPG, PNG or WebP food photo");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw httpError(413, "Photo must be smaller than 2 MB");
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    match[1]
  ];
  return { dataUrl: value, bytes, mime: match[1], extension };
}

function outputText(data) {
  return (
    data?.output_text ||
    data?.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text ||
    ""
  );
}

async function aiReviewPhoto(photo, item) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      decision: "admin_review",
      confidence: null,
      reason: "Automatic review is unavailable; queued for VASI review.",
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_MENU_PHOTO_MODEL ||
          process.env.OPENAI_SUPPORT_MODEL ||
          "gpt-5-mini",
        instructions:
          "Review a restaurant menu photo for a delivery marketplace. Approve only when it clearly shows food or a sealed drink that plausibly matches the menu item, is sufficiently lit and sharp, has no prominent watermark, contact details, price text, QR code, unrelated people, unsafe or explicit material. Use needs_changes only for a clear objective failure such as no food, severe blur/darkness, advertising text, or unsafe content. Use admin_review for uncertainty, possible mismatch, branded packaging, or borderline quality. Be conservative. Give one short, helpful reason without identifying people or inferring sensitive traits.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  item_name: item.name,
                  description: item.description,
                  category: item.category,
                }),
              },
              { type: "input_image", image_url: photo.dataUrl, detail: "low" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "vasi_menu_photo_review",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                decision: {
                  type: "string",
                  enum: ["approved", "needs_changes", "admin_review"],
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string", minLength: 3, maxLength: 180 },
              },
              required: ["decision", "confidence", "reason"],
            },
          },
        },
        max_output_tokens: 220,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI status ${response.status}`);
    const result = JSON.parse(outputText(await response.json()));
    const confidence = Number(result.confidence);
    const decision =
      result.decision === "approved" && confidence < 0.9
        ? "admin_review"
        : ["approved", "needs_changes", "admin_review"].includes(result.decision)
          ? result.decision
          : "admin_review";
    return {
      decision,
      confidence: Number.isFinite(confidence) ? confidence : null,
      reason: clean(
        decision === "admin_review" && result.decision === "approved"
          ? "Photo looks suitable; queued for final VASI review."
          : result.reason,
        240,
      ),
    };
  } catch (error) {
    console.warn("[restaurant-photo-review] safe fallback", error?.message);
    return {
      decision: "admin_review",
      confidence: null,
      reason: "Automatic review could not finish; queued for VASI review.",
    };
  }
}

async function uploadPhoto(photo, path) {
  const response = await fetch(
    `${url}/storage/v1/object/${PHOTO_BUCKET}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: auth,
        "Content-Type": photo.mime,
        "Cache-Control": "31536000",
      },
      body: photo.bytes,
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw httpError(
      response.status,
      data?.message || "Photo upload failed. Please try again.",
    );
  }
}

async function savePrivilegedDecision(itemId, candidateUrl, review) {
  if (!serviceKey) return null;
  const approved = review.decision === "approved";
  const response = await fetch(
    `${url}/rest/v1/restaurant_menu_items?id=eq.${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        photo_url: approved ? candidateUrl : null,
        photo_status: review.decision,
        photo_review_reason: review.reason,
        photo_ai_confidence: review.confidence,
        photo_checked_at: new Date().toISOString(),
        photo_reviewed_by: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.message || "Could not store photo review");
  return data?.[0] || null;
}

async function submitPhoto(account, restaurant, body) {
  const itemId = clean(body.id, 60);
  const item = (
    await db(
      `restaurant_menu_items?select=id,name,description,category,restaurant_id&id=eq.${encodeURIComponent(itemId)}&restaurant_id=eq.${restaurant.id}&limit=1`,
    )
  )[0];
  if (!item) throw httpError(404, "Menu item not found");

  const photo = imagePayload(body.image);
  const unique = crypto.randomUUID();
  const path = `${account.id}/${item.id}/${unique}.${photo.extension}`;
  const publicPath = path.split("/").map(encodeURIComponent).join("/");
  const candidateUrl = `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${publicPath}`;

  await uploadPhoto(photo, path);
  await rpc("vasi_restaurant_set_menu_photo_pending", {
    p_item_id: item.id,
    p_photo_path: path,
    p_candidate_url: candidateUrl,
  });

  const review = await aiReviewPhoto(photo, item);
  let saved = null;
  try {
    saved = await savePrivilegedDecision(item.id, candidateUrl, review);
  } catch (error) {
    console.error("[restaurant-photo-review] privileged save failed", error?.message);
  }

  if (!saved) {
    const safeReview =
      review.decision === "approved"
        ? {
            decision: "admin_review",
            confidence: review.confidence,
            reason: "Photo passed automatic checks; queued for final VASI approval.",
          }
        : review;
    saved = await rpc("vasi_restaurant_finish_menu_photo_review", {
      p_item_id: item.id,
      p_status: safeReview.decision,
      p_reason: safeReview.reason,
      p_confidence: safeReview.confidence,
    });
  }
  return saved;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const account = await user(req);
    if (!account) return res.status(401).json({ error: "Login required" });
    let restaurant = (
      await db(
        `restaurants?select=*&owner_id=eq.${account.id}&order=created_at.asc&limit=1`,
      )
    )[0] || null;

    if (req.method === "GET") {
      if (!restaurant)
        return res.status(200).json({ restaurant: null, menu: [], orders: [] });
      const [menu, orders] = await Promise.all([
        db(
          `restaurant_menu_items?select=*&restaurant_id=eq.${restaurant.id}&order=sort_order.asc,created_at.asc`,
        ),
        db(
          `eats_orders?select=id,created_at,items,subtotal,delivery_fee,total,status,delivery_address&restaurant_id=eq.${restaurant.id}&order=created_at.desc&limit=50`,
        ),
      ]);
      return res.status(200).json({ restaurant, menu, orders });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = clean(body.action, 40);
    if (action === "register") {
      const fields = [
        "name",
        "legal_name",
        "siret",
        "phone",
        "email",
        "address",
        "city",
        "postal_code",
        "cuisine",
      ];
      if (fields.some((field) => clean(body[field]).length < 2))
        return res
          .status(400)
          .json({ error: "Complete all restaurant and business fields" });
      restaurant = await rpc("vasi_register_restaurant", {
        p_name: clean(body.name),
        p_legal_name: clean(body.legal_name),
        p_siret: clean(body.siret, 17),
        p_phone: clean(body.phone),
        p_email: clean(body.email),
        p_address: clean(body.address),
        p_city: clean(body.city),
        p_postal_code: clean(body.postal_code),
        p_cuisine: clean(body.cuisine),
        p_delivery_mode: body.delivery_mode === "own" ? "own" : "vasi",
      });
      return res.status(201).json({ restaurant });
    }

    if (!restaurant)
      return res.status(404).json({ error: "Register your restaurant first" });
    if (action === "add_item") {
      const price = Number(body.price);
      if (clean(body.name).length < 2 || !Number.isFinite(price))
        return res
          .status(400)
          .json({ error: "Enter a valid item name and price" });
      const item = await rpc("vasi_restaurant_add_item", {
        p_name: clean(body.name, 100),
        p_description: clean(body.description, 300),
        p_category: clean(body.category, 60) || "Menu",
        p_price: price,
        p_allergens: clean(body.allergens, 300)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      return res.status(201).json({ item });
    }
    if (action === "submit_photo")
      return res
        .status(200)
        .json({ item: await submitPhoto(account, restaurant, body) });
    if (action === "toggle_item")
      return res.status(200).json({
        item: await rpc("vasi_restaurant_toggle_item", {
          p_item_id: clean(body.id, 60),
          p_active: Boolean(body.active),
        }),
      });
    if (action === "toggle_open")
      return res.status(200).json({
        restaurant: await rpc("vasi_restaurant_toggle_open", {
          p_is_open: Boolean(body.is_open),
        }),
      });
    if (action === "order_status")
      return res.status(200).json({
        order: await rpc("vasi_restaurant_order_status", {
          p_order_id: clean(body.id, 60),
          p_status: clean(body.status, 40),
        }),
      });
    return res.status(400).json({ error: "Unsupported action" });
  } catch (error) {
    return res
      .status(Number(error?.status) || 500)
      .json({ error: error?.message || "Restaurant service error" });
  }
}
