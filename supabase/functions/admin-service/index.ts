import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const text = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

const motorCourierVehicles = new Set(['scooter', 'moto', 'car']);
function courierRequiredDocuments(vehicleType: string) {
  const required = ['identity', 'business', 'rib', 'bag', 'vehicle_photo', 'selfie'];
  if (motorCourierVehicles.has(vehicleType)) {
    required.push('licence', 'insurance', 'carte_grise', 'transport_licence');
  }
  return required;
}

function envKey(jsonName: string, legacyName: string) {
  try {
    const keys = JSON.parse(Deno.env.get(jsonName) || '{}');
    if (keys.default) return keys.default;
  } catch {
    // Fall through to the legacy key while projects migrate.
  }
  return Deno.env.get(legacyName) || '';
}

function pricingShape(row: Record<string, unknown>) {
  const starts = row.starts_at ? Date.parse(String(row.starts_at)) : null;
  const ends = row.ends_at ? Date.parse(String(row.ends_at)) : null;
  const classes: Record<string, unknown> = {};
  for (const name of ['go', 'comfort', 'xl', 'van']) {
    classes[name] = {
      base: Number(row[name + '_base']),
      km: Number(row[name + '_per_km']),
      min: Number(row[name + '_per_minute']),
      minFare: Number(row[name + '_minimum']),
    };
  }
  return {
    offer_active: Boolean(row.offer_active) && (!starts || Date.now() >= starts) && (!ends || Date.now() < ends),
    offer_enabled: Boolean(row.offer_active),
    offer_name: row.offer_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    offer_mode: row.offer_mode === 'percentage' ? 'percentage' : 'fixed',
    discount_percent: Number(row.discount_percent || 0),
    max_discount_eur: row.max_discount_eur == null ? null : Number(row.max_discount_eur),
    minimum_regular_fare: row.minimum_regular_fare == null ? null : Number(row.minimum_regular_fare),
    ride_commission_percent: Number(row.ride_commission_percent ?? 15),
    classes,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !secretKey) return json({ error: 'Admin service configuration unavailable' }, 503);

  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user?.id || !user.email) return json({ error: 'Unauthorized' }, 401);

  const db = createClient(url, secretKey);
  const { data: allowed, error: allowError } = await db
    .from('admin_allowlist')
    .select('email')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();
  if (allowError || !allowed) return json({ error: 'Forbidden' }, 403);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = text(body.action, 60);

  async function audit(name: string, targetType: string, targetId: string | null, details: Record<string, unknown>) {
    const { error } = await db.from('admin_audit_log').insert({
      admin_id: user!.id, action: name, target_type: targetType, target_id: targetId, details,
    });
    if (error) throw error;
  }

  async function stats() {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const iso = start.toISOString();
    const count = async (table: string, apply?: (query: any) => any) => {
      let query = db.from(table).select('id', { count: 'exact', head: true });
      if (apply) query = apply(query);
      const { count: value, error } = await query;
      if (error) throw error;
      return value ?? 0;
    };
    const [
      drivers, customers, bookings, documents, payments, activeRides, onlineDrivers,
      verifiedDrivers, pendingDocuments, completedToday, bookingToday, paymentToday,
    ] = await Promise.all([
      count('drivers'),
      count('profiles', q => q.eq('role', 'customer')),
      count('bookings'),
      count('driver_documents'),
      count('payments'),
      count('rides', q => q.in('status', ['requested', 'accepted', 'driver_arriving', 'in_progress'])),
      count('drivers', q => q.eq('online', true)),
      count('drivers', q => q.eq('verified', true)),
      count('driver_documents', q => q.eq('status', 'pending')),
      count('rides', q => q.eq('status', 'completed').gte('requested_at', iso)),
      count('bookings', q => q.gte('created_at', iso)),
      count('payments', q => q.gte('created_at', iso)),
    ]);
    const [{ data: todayBookings, error: bookingError }, { data: todayRides, error: rideError }, { data: todayPayments, error: paymentError }] =
      await Promise.all([
        db.from('bookings').select('estimated_price,vasi_commission,driver_amount').gte('created_at', iso),
        db.from('rides').select('final_fare,estimated_fare,status').gte('requested_at', iso),
        db.from('payments').select('amount,status').gte('created_at', iso),
      ]);
    if (bookingError || rideError || paymentError) throw bookingError || rideError || paymentError;
    const sum = (rows: any[] | null, field: string) => (rows || []).reduce((total, row) => total + (Number(row[field]) || 0), 0);
    return {
      drivers, customers, bookings, documents, payments, activeRides, onlineDrivers,
      verifiedDrivers, pendingDocuments, completedToday, bookingToday, paymentToday,
      todayGross: sum(todayBookings, 'estimated_price') || sum(todayRides, 'final_fare'),
      todayCommission: sum(todayBookings, 'vasi_commission'),
      todayDriverAmount: sum(todayBookings, 'driver_amount'),
      todayPaymentsAmount: sum(todayPayments, 'amount'),
    };
  }

  try {
    if (action === 'check_access') return json({ ok: true, admin_email: user.email });
    if (action === 'dashboard') return json({ ok: true, admin_email: user.email, dashboard: await stats() });
    if (action === 'stats') return json({ ok: true, stats: await stats() });

    if (action === 'list_bookings') {
      const { data, error } = await db.from('bookings')
        .select('id,created_at,pickup,destination,ride_date,ride_time,passengers,vehicle,payment_method,estimated_price,vasi_commission,driver_amount,customer_name,customer_phone,status,driver_id,payment_status,currency')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, bookings: data || [] });
    }
    if (action === 'update_booking') {
      const id = text(body.id, 80);
      const patch: Record<string, unknown> = {};
      if (typeof body.driver_id === 'string' && body.driver_id) patch.driver_id = body.driver_id;
      if (['pending', 'requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled'].includes(body.status)) patch.status = body.status;
      if (!id || !Object.keys(patch).length) return json({ error: 'No supported booking change' }, 400);
      const { data, error } = await db.from('bookings').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('booking_update', 'booking', id, patch);
      return json({ ok: true, booking: data });
    }

    if (action === 'list_drivers') {
      const { data, error } = await db.from('drivers')
        .select('id,full_name,phone,role,status,rejection_reason,online,verified,latitude,longitude,vehicle_type,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, drivers: data || [] });
    }
    if (action === 'update_driver') {
      const id = text(body.id, 80);
      if (!id) return json({ error: 'Driver id required' }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof body.verified === 'boolean') {
        patch.verified = body.verified;
        patch.status = body.verified ? 'approved' : 'pending';
        patch.rejection_reason = null;
        if (!body.verified) patch.online = false;
      }
      if (typeof body.online === 'boolean') patch.online = body.online;
      if (!Object.keys(patch).length) return json({ error: 'No supported driver change' }, 400);
      const { data, error } = await db.from('drivers').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('driver_update', 'driver', id, patch);
      return json({ ok: true, driver: data });
    }

    if (action === 'live_gps') {
      const [{ data: drivers, error: driverError }, { data: rides, error: rideError }] = await Promise.all([
        db.from('drivers').select('id,full_name,phone,online,verified,latitude,longitude,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating,updated_at').order('online', { ascending: false }).order('updated_at', { ascending: false }).limit(200),
        db.from('rides').select('id,driver_id,status,pickup_address,destination_address,pickup_lat,pickup_lng,destination_lat,destination_lng,requested_at,accepted_at').in('status', ['requested', 'accepted', 'driver_arriving', 'in_progress']).order('requested_at', { ascending: false }).limit(200),
      ]);
      if (driverError || rideError) throw driverError || rideError;
      const byDriver = new Map((rides || []).filter(r => r.driver_id).map(r => [r.driver_id, r]));
      const now = Date.now();
      return json({
        ok: true,
        updated_at: new Date().toISOString(),
        drivers: (drivers || []).map(driver => {
          const age = driver.updated_at ? Math.max(0, Math.round((now - new Date(driver.updated_at).getTime()) / 1000)) : null;
          return { ...driver, location_age_seconds: age, stale: age === null || age > 60, active_ride: byDriver.get(driver.id) || null };
        }),
        active_rides: rides || [],
      });
    }

    if (action === 'list_partners') {
      const status = ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'pending';
      const { data, error } = await db.from('delivery_drivers')
        .select('id,user_id,full_name,phone,address,vehicle_type,online,verified,documents,application_status,rejection_reason,reviewed_at,created_at,updated_at')
        .eq('application_status', status)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const partners = await Promise.all((data || []).map(async (partner: any) => {
        const documentLinks: Record<string, string> = {};
        for (const [name, rawPath] of Object.entries(partner.documents || {})) {
          const path = text(rawPath, 500);
          if (!path || !path.startsWith(`${partner.user_id}/`)) continue;
          const { data: signed } = await db.storage.from('partner-documents').createSignedUrl(path, 600);
          if (signed?.signedUrl) documentLinks[name] = signed.signedUrl;
        }
        return {
          ...partner,
          role: 'courier',
          required_documents: courierRequiredDocuments(text(partner.vehicle_type, 20)),
          document_links: documentLinks,
        };
      }));
      return json({ ok: true, partners });
    }
    if (action === 'review_partner') {
      const id = text(body.partner_id || body.id, 80);
      const status = ['approved', 'rejected'].includes(body.status) ? body.status : '';
      if (!id || !status) return json({ error: 'Partner and decision required' }, 400);
      const { data: partner, error: findError } = await db.from('delivery_drivers')
        .select('id,user_id,vehicle_type,documents,application_status').eq('id', id).maybeSingle();
      if (findError) throw findError;
      if (!partner) return json({ error: 'Courier not found' }, 404);
      const required = courierRequiredDocuments(text(partner.vehicle_type, 20));
      const missing = required.filter(name => !text(partner.documents?.[name], 500));
      if (status === 'approved' && missing.length) {
        return json({ error: `Missing required documents: ${missing.join(', ')}` }, 400);
      }
      const patch = {
        verified: status === 'approved',
        application_status: status,
        online: false,
        rejection_reason: status === 'rejected' ? text(body.reason || 'Documents non conformes', 500) : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db.from('delivery_drivers').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('courier_review', 'delivery_driver', id, { status, reason: patch.rejection_reason, required_documents: required });
      return json({ ok: true, partner: data });
    }

    if (action === 'list_documents') {
      const { data, error } = await db.from('driver_documents')
        .select('id,driver_id,document_type,file_path,status,rejection_reason,expires_at,reviewed_at,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, documents: data || [] });
    }
    if (action === 'review_document') {
      const id = text(body.id, 80);
      const status = ['approved', 'rejected'].includes(body.status) ? body.status : '';
      if (!id || !status) return json({ error: 'Document id and decision required' }, 400);
      const patch = {
        status, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
        rejection_reason: status === 'rejected' ? text(body.reason || body.rejection_reason || 'Refus administrateur') : null,
      };
      const { data, error } = await db.from('driver_documents').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('document_review', 'driver_document', id, { status, reason: patch.rejection_reason });
      return json({ ok: true, document: data });
    }

    if (action === 'list_restaurants') {
      const status = ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'pending';
      const { data, error } = await db.from('restaurants').select('*').eq('status', status).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, restaurants: data || [] });
    }
    if (action === 'list_menu_photo_reviews') {
      const requested = ['checking', 'admin_review', 'needs_changes', 'approved'].includes(body.status) ? body.status : 'admin_review';
      const { data: photos, error: photoError } = await db.from('restaurant_menu_items')
        .select('id,restaurant_id,name,category,photo_candidate_url,photo_url,photo_status,photo_review_reason,photo_ai_confidence,photo_checked_at,updated_at')
        .eq('photo_status', requested).order('updated_at', { ascending: false }).limit(100);
      if (photoError) throw photoError;
      const restaurantIds = [...new Set((photos || []).map((photo: any) => photo.restaurant_id).filter(Boolean))];
      let restaurants: any[] = [];
      if (restaurantIds.length) {
        const { data, error } = await db.from('restaurants').select('id,name,email,phone').in('id', restaurantIds);
        if (error) throw error;
        restaurants = data || [];
      }
      const byId = new Map(restaurants.map((restaurant: any) => [restaurant.id, restaurant]));
      return json({
        ok: true,
        photos: (photos || []).map((photo: any) => ({ ...photo, restaurant: byId.get(photo.restaurant_id) || null })),
      });
    }
    if (action === 'review_menu_photo') {
      const id = text(body.photo_id, 80);
      const status = ['approved', 'needs_changes'].includes(body.status) ? body.status : '';
      if (!id || !status) return json({ error: 'Photo and decision required' }, 400);
      const { data: existing, error: findError } = await db.from('restaurant_menu_items')
        .select('id,photo_candidate_url,photo_status').eq('id', id).maybeSingle();
      if (findError) throw findError;
      if (!existing?.photo_candidate_url) return json({ error: 'Photo not found' }, 404);
      const reason = status === 'approved'
        ? 'Approved by VASI.'
        : text(body.reason || 'Please upload a clearer food photo without text or watermarks.', 240);
      const patch = {
        photo_url: status === 'approved' ? existing.photo_candidate_url : null,
        photo_status: status,
        photo_review_reason: reason,
        photo_checked_at: new Date().toISOString(),
        photo_reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db.from('restaurant_menu_items').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('menu_photo_review', 'restaurant_menu_item', id, { status, reason, previous_status: existing.photo_status });
      return json({ ok: true, photo: data });
    }
    if (action === 'review_restaurant') {
      const id = text(body.id, 80);
      const status = ['approved', 'rejected'].includes(body.status) ? body.status : '';
      if (!id || !status) return json({ error: 'Restaurant and decision required' }, 400);
      const commission = body.commission_rate == null ? 0.10 : Number(body.commission_rate);
      if (!Number.isFinite(commission) || commission !== 0.10) return json({ error: 'Restaurant commission must be 10%' }, 400);
      const patch: Record<string, unknown> = {
        status, active: status === 'approved', rejection_reason: status === 'rejected' ? text(body.reason || 'Refus administrateur') : null,
        updated_at: new Date().toISOString(),
      };
      patch.commission_rate = commission;
      const { data, error } = await db.from('restaurants').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('restaurant_review', 'restaurant', id, { status, reason: patch.rejection_reason, commission_rate: commission });
      return json({ ok: true, restaurant: data });
    }

    if (action === 'update_pricing') {
      const update: Record<string, unknown> = {
        offer_active: Boolean(body.offer_active),
        offer_name: text(body.offer_name, 80),
        offer_mode: body.offer_mode === 'percentage' ? 'percentage' : 'fixed',
        discount_percent: Number(body.discount_percent),
        ride_commission_percent: Number(body.ride_commission_percent),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };
      if (!update.offer_name) return json({ error: 'Offer name is required' }, 400);
      if (!Number.isFinite(update.discount_percent) || Number(update.discount_percent) < 0 || Number(update.discount_percent) > 50) return json({ error: 'Discount must be between 0% and 50%' }, 400);
      if (!Number.isFinite(update.ride_commission_percent) || Number(update.ride_commission_percent) < 0 || Number(update.ride_commission_percent) > 50) return json({ error: 'Ride commission must be between 0% and 50%' }, 400);
      for (const key of ['max_discount_eur', 'minimum_regular_fare']) {
        const value = body[key] === '' || body[key] == null ? null : Number(body[key]);
        if (value != null && (!Number.isFinite(value) || value < 0 || value > 1000)) return json({ error: `Invalid ${key}` }, 400);
        update[key] = value;
      }
      for (const vehicle of ['go', 'comfort', 'xl', 'van']) {
        for (const suffix of ['base', 'per_km', 'per_minute', 'minimum']) {
          const key = `${vehicle}_${suffix}`, value = Number(body[key]);
          if (!Number.isFinite(value) || value < 0 || value > 1000) return json({ error: `Invalid ${key}` }, 400);
          update[key] = value;
        }
      }
      for (const key of ['starts_at', 'ends_at']) {
        const value = body[key] ? new Date(body[key]).toISOString() : null;
        if (body[key] && !Number.isFinite(Date.parse(String(value)))) return json({ error: `Invalid ${key}` }, 400);
        update[key] = value;
      }
      if (update.starts_at && update.ends_at && Date.parse(String(update.ends_at)) <= Date.parse(String(update.starts_at))) return json({ error: 'End date must be after start date' }, 400);
      const { data, error } = await db.from('vasi_pricing_settings').update(update).eq('id', 'active').select().maybeSingle();
      if (error) throw error;
      await audit('pricing_update', 'pricing', null, { offer_name: update.offer_name, discount_percent: update.discount_percent, ride_commission_percent: update.ride_commission_percent });
      return json({ ok: true, pricing: pricingShape(data || update) });
    }

    if (action === 'list_support') {
      const { data, error } = await db.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, tickets: data || [] });
    }
    if (action === 'update_support') {
      const id = text(body.id, 80);
      const status = ['open', 'waiting_human', 'in_progress', 'resolved', 'closed'].includes(body.status) ? body.status : 'in_progress';
      const humanReply = text(body.human_reply, 2000);
      if (!id) return json({ error: 'Ticket required' }, 400);
      const patch = { status, human_reply: humanReply, updated_at: new Date().toISOString() };
      const { data, error } = await db.from('support_tickets').update(patch).eq('id', id).select().maybeSingle();
      if (error) throw error;
      await audit('support_update', 'support_ticket', id, { status });
      return json({ ok: true, ticket: data });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[admin-service] action failed', { action, admin: user.email, error: String(error) });
    return json({ error: error instanceof Error ? error.message : 'Admin service error' }, 500);
  }
});
