import { supabase } from './supabase.js';

/* ── Data mappers ───────────────────────────────────────── */
function mapVehicle(r) {
  return {
    id: r.id, name: r.name, category: r.category,
    passengers: r.passengers, luggage: r.luggage,
    badge: r.badge, badgeType: r.badge_type,
    features: Array.isArray(r.features) ? r.features : [],
    description: r.description, image: r.image,
    enabled: r.enabled, order: r.sort_order,
  };
}

function mapBooking(r) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    tripType: r.trip_type,
    pickup: r.pickup, pickupSub: r.pickup_sub, pickupCountry: r.pickup_country,
    dropoff: r.dropoff, dropoffSub: r.dropoff_sub, dropoffCountry: r.dropoff_country,
    date: r.date, time: r.time, returnDate: r.return_date, returnTime: r.return_time,
    vehicleId: r.vehicle_id, vehicle: r.vehicle,
    estimatedDistance: r.estimated_distance, estimatedFare: r.estimated_fare,
    status: r.status, payment: r.payment, notes: r.notes, source: r.source,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function mapCustomer(r) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    bookings: r.bookings, lastBooking: r.last_booking,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function mapPricing(r) {
  if (!r) return {};
  return { currency: r.currency, min: r.min, perkm: r.perkm, airport: r.airport, night: r.night, weekend: r.weekend };
}

function mapFormSettings(r) {
  if (!r) return {};
  return { title1: r.title1, title2: r.title2, title3: r.title3, btn1Text: r.btn1_text, btn2Text: r.btn2_text, btnSubmitText: r.btn_submit_text };
}

function mapSettings(r) {
  if (!r) return {};
  return { company: r.company, phone: r.phone, email: r.email, address: r.address, website: r.website, currency: r.currency };
}

function mapTrackingSettings(r) {
  if (!r) return {};
  return { landingCode: r.landing_code || '', thankyouCode: r.thankyou_code || '' };
}

/* ── Vehicles ────────────────────────────────────────────── */
export async function getVehicles() {
  const { data, error } = await supabase.from('vehicles').select('*').order('sort_order');
  if (error) throw error;
  return data.map(mapVehicle);
}

export async function saveVehicle(v) {
  const row = {
    id: v.id || ('v' + Date.now()),
    name: v.name, category: v.category || '',
    passengers: v.passengers || 4, luggage: v.luggage || 2,
    badge: v.badge || '', badge_type: v.badgeType || 'green',
    features: Array.isArray(v.features) ? v.features : [],
    description: v.description || '', image: v.image || '',
    enabled: v.enabled !== false,
    sort_order: v.order || 0,
  };
  const { error } = await supabase.from('vehicles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return row.id;
}

export async function deleteVehicle(id) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleVehicle(id, enabled) {
  const { error } = await supabase.from('vehicles').update({ enabled }).eq('id', id);
  if (error) throw error;
}

/* ── Bookings ────────────────────────────────────────────── */
export async function getBookings() {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapBooking);
}

export async function saveBooking(b) {
  const row = {
    id: b.id, name: b.name, email: b.email, phone: b.phone || null,
    trip_type: b.tripType || 'one-way',
    pickup: b.pickup || null, pickup_sub: b.pickupSub || null, pickup_country: b.pickupCountry || null,
    dropoff: b.dropoff || null, dropoff_sub: b.dropoffSub || null, dropoff_country: b.dropoffCountry || null,
    date: b.date || null, time: b.time || null,
    return_date: b.returnDate || null, return_time: b.returnTime || null,
    vehicle_id: b.vehicleId || null, vehicle: b.vehicle || null,
    estimated_distance: b.estimatedDistance || null, estimated_fare: b.estimatedFare || null,
    status: b.status || 'pending', payment: b.payment || 'unpaid',
    notes: b.notes || null, source: b.source || 'website',
  };
  const { error } = await supabase.from('bookings').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function updateBookingStatus(id, status) {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteBooking(id) {
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
}

/* ── Customers ───────────────────────────────────────────── */
export async function getCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapCustomer);
}

export async function upsertCustomer(c) {
  const { data: existing } = await supabase.from('customers').select('id,bookings').eq('email', c.email).maybeSingle();
  if (existing) {
    await supabase.from('customers').update({ name: c.name, phone: c.phone, bookings: (existing.bookings || 0) + 1, last_booking: c.lastBooking }).eq('id', existing.id);
  } else {
    await supabase.from('customers').insert({ id: c.id, name: c.name, email: c.email, phone: c.phone, bookings: 1, last_booking: c.lastBooking });
  }
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

/* ── Vehicle Pricing ─────────────────────────────────────── */
export async function getVehiclePricing() {
  const { data, error } = await supabase.from('vehicle_pricing').select('*');
  if (error) throw error;
  const result = {};
  for (const r of data) result[r.vehicle_id] = { basePrice: r.base_price, pricePerKm: r.price_per_km, minPrice: r.min_price };
  return result;
}

export async function saveVehiclePricing(vehicleId, p) {
  const { error } = await supabase.from('vehicle_pricing').upsert(
    { vehicle_id: vehicleId, base_price: p.basePrice, price_per_km: p.pricePerKm, min_price: p.minPrice },
    { onConflict: 'vehicle_id' }
  );
  if (error) throw error;
}

/* ── Pricing Settings ────────────────────────────────────── */
export async function getPricing() {
  const { data } = await supabase.from('pricing_settings').select('*').eq('id', 1).maybeSingle();
  return mapPricing(data);
}

export async function savePricing(p) {
  const { error } = await supabase.from('pricing_settings').upsert(
    { id: 1, currency: p.currency || 'CHF', min: p.min || 0, perkm: p.perkm || 0, airport: p.airport || 0, night: p.night || 0, weekend: p.weekend || 0 },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/* ── Service Areas ───────────────────────────────────────── */
export async function getAreas() {
  const { data, error } = await supabase.from('service_areas').select('*').order('code');
  if (error) throw error;
  return data;
}

export async function toggleArea(code, enabled) {
  const { error } = await supabase.from('service_areas').update({ enabled }).eq('code', code);
  if (error) throw error;
}

/* ── Form Settings ───────────────────────────────────────── */
export async function getFormSettings() {
  const { data } = await supabase.from('form_settings').select('*').eq('id', 1).maybeSingle();
  return mapFormSettings(data);
}

export async function saveFormSettings(fs) {
  const { error } = await supabase.from('form_settings').upsert(
    { id: 1, title1: fs.title1, title2: fs.title2, title3: fs.title3, btn1_text: fs.btn1Text, btn2_text: fs.btn2Text, btn_submit_text: fs.btnSubmitText },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/* ── App Settings ────────────────────────────────────────── */
export async function getSettings() {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  return mapSettings(data);
}

export async function saveSettings(s) {
  const { error } = await supabase.from('app_settings').upsert(
    { id: 1, company: s.company || '', phone: s.phone || '', email: s.email || '', address: s.address || '', website: s.website || '', currency: s.currency || 'CHF' },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/* ── Tracking Codes (Google Ads / Analytics) ────────────────── */
export async function getTrackingSettings() {
  const { data } = await supabase.from('tracking_settings').select('*').eq('id', 1).maybeSingle();
  return mapTrackingSettings(data);
}

export async function saveTrackingSettings(t) {
  const { error } = await supabase.from('tracking_settings').upsert(
    { id: 1, landing_code: t.landingCode || '', thankyou_code: t.thankyouCode || '' },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/* ── Admin Users ─────────────────────────────────────────── */
export async function getAdmins() {
  const { data, error } = await supabase.from('admin_users').select('*');
  if (error) throw error;
  return data;
}

export async function loginAdmin(email, password) {
  const { data } = await supabase.from('admin_users').select('*').eq('email', email).eq('status', 'active').maybeSingle();
  if (!data || data.password !== password) return null;
  return data;
}

export async function saveAdminUser(u) {
  const row = { id: u.id || ('A-' + Date.now()), name: u.name, email: u.email, password: u.password || '', role: u.role || 'admin', status: u.status || 'active' };
  const { error } = await supabase.from('admin_users').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return row;
}

export async function deleteAdmin(id) {
  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) throw error;
}
