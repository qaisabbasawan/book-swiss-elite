require('dotenv').config();
const express    = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');
const https      = require('https');
const Stripe     = require('stripe');

const app  = express();
const PORT = process.env.PORT || 5000;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(express.json());

/* ── Serve React build in production ─────────────────── */
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

/* ── Distance endpoint (Google Maps primary · OSRM+Nominatim fallback) ── */
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function googleDistanceMatrix(originStr, destStr, key) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
    + `?origins=${encodeURIComponent(originStr)}`
    + `&destinations=${encodeURIComponent(destStr)}`
    + `&mode=driving&key=${key}`;
  const data = await httpsGet(url, {});
  const el = data.rows?.[0]?.elements?.[0];
  if (data.status !== 'OK' || el?.status !== 'OK') {
    throw new Error(`Google Distance Matrix: ${el?.status || data.status}`);
  }
  return {
    distanceKm: Math.round(el.distance.value / 1000),
    durationMin: Math.round(el.duration.value / 60),
  };
}

async function nominatimGeocode(query) {
  const url = `https://nominatim.openstreetmap.org/search`
    + `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ch,fr,it`;
  const results = await httpsGet(url, {
    'User-Agent': 'SwissEliteChauffeur/1.0 (book.swisselitetransfers.com)',
    'Accept-Language': 'en',
  });
  if (!Array.isArray(results) || !results.length) {
    throw new Error(`No geocoding result for: "${query}"`);
  }
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function osrmRoute(lat1, lng1, lat2, lng2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  const data = await httpsGet(url, { 'User-Agent': 'SwissEliteChauffeur/1.0' });
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM returned no route');
  return {
    distanceKm: Math.round(data.routes[0].distance / 1000),
    durationMin: Math.round(data.routes[0].duration / 60),
  };
}

app.get('/api/distance', async (req, res) => {
  const { olat, olng, dlat, dlng, origin, destination } = req.query;

  const hasOriginCoords = olat && olng;
  const hasDestCoords   = dlat && dlng;

  if (!hasOriginCoords && !origin)      return res.status(400).json({ ok: false, error: 'Missing origin' });
  if (!hasDestCoords   && !destination) return res.status(400).json({ ok: false, error: 'Missing destination' });

  const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

  /* ── Strategy 1: Google Maps Distance Matrix (most accurate) ── */
  if (GOOGLE_KEY) {
    try {
      const originStr = hasOriginCoords ? `${olat},${olng}` : origin;
      const destStr   = hasDestCoords   ? `${dlat},${dlng}` : destination;
      const result = await googleDistanceMatrix(originStr, destStr, GOOGLE_KEY);
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.warn('[Distance/Google] failed, falling back to OSRM:', e.message);
    }
  }

  /* ── Strategy 2: Nominatim geocoding + OSRM routing ── */
  try {
    const p1 = hasOriginCoords
      ? { lat: parseFloat(olat), lng: parseFloat(olng) }
      : await nominatimGeocode(origin);

    const p2 = hasDestCoords
      ? { lat: parseFloat(dlat), lng: parseFloat(dlng) }
      : await nominatimGeocode(destination);

    const result = await osrmRoute(p1.lat, p1.lng, p2.lat, p2.lng);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Distance/OSRM]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Stripe payment intent ────────────────────────────── */
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(500).json({ ok: false, error: 'Stripe not configured' });
  const { amount, currency, bookingRef } = req.body;
  if (!amount) return res.status(400).json({ ok: false, error: 'Missing amount' });
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: (currency || 'chf').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { bookingRef: bookingRef || '' },
    });
    res.json({ ok: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[Stripe] PaymentIntent error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Email endpoint ───────────────────────────────────── */
app.post('/api/send-email', async (req, res) => {
  const d = req.body;
  if (!d?.email || !d?.name) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const SMTP_USER   = process.env.SMTP_USER;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@swisselitetransfers.com';

  if (!SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[Mailer] SMTP_USER or SMTP_PASS env var is not set');
    return res.status(500).json({ ok: false, error: 'SMTP credentials not configured' });
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.hostinger.com',
    port:   parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });

  try {
    /* 1. Confirmation to customer */
    await transporter.sendMail({
      from:    `"Swiss Elite Chauffeur" <${SMTP_USER}>`,
      to:      d.email,
      replyTo: ADMIN_EMAIL,
      subject: `Booking Confirmed — ${d.ref} | Swiss Elite Chauffeur`,
      html:    buildEmail(d),
    });

    /* 2. Notification to admin */
    await transporter.sendMail({
      from:    `"Swiss Elite Bookings" <${SMTP_USER}>`,
      to:      ADMIN_EMAIL,
      subject: `🆕 New Booking ${d.ref} — ${d.name} | ${d.pickup} → ${d.dropoff}`,
      html:    buildAdminEmail(d),
    });

    console.log(`[Mailer] Booking ${d.ref} — sent to ${d.email} + admin ${ADMIN_EMAIL}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Mailer] Send failed:', err.message, err.response || '');
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── React catch-all in production ───────────────────── */
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  );
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/* ── Email HTML template ──────────────────────────────── */
function fmt(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'; }
function fmtT(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function row(label, val) {
  return `<tr>
    <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;vertical-align:top;white-space:nowrap">${label}</td>
    <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;font-weight:500;color:#f0ede6;vertical-align:top">${val}</td>
  </tr>`;
}

function routeBlock(pickupLabel, pickup, dropoff) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:12px"><tr>
    <td style="width:36px;padding:20px 0 20px 18px;vertical-align:top">
      <div style="width:10px;height:10px;background:#C8A45D;border-radius:50%;margin-bottom:4px"></div>
      <div style="width:1px;height:24px;background:rgba(200,164,93,0.35);margin:0 0 4px 4px"></div>
      <div style="width:10px;height:10px;background:#C8A45D;border-radius:2px"></div>
    </td>
    <td style="padding:16px 18px 16px 8px;vertical-align:top">
      <div style="margin-bottom:18px">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;margin-bottom:4px">PICKUP</div>
        <div style="font-size:14px;font-weight:600;color:#f0ede6">${pickup || '—'}</div>
      </div>
      <div>
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;margin-bottom:4px">DROP-OFF</div>
        <div style="font-size:14px;font-weight:600;color:#f0ede6">${dropoff || '—'}</div>
      </div>
    </td>
  </tr></table>`;
}

function buildEmail(d) {
  const isRound   = d.tripType === 'round-trip';
  const tripLabel = isRound ? 'Round Trip' : 'One Way';

  const returnPickup  = d.returnPickup  || d.dropoff || '—';
  const returnDropoff = d.returnDropoff || d.pickup  || '—';

  const returnRows = isRound && d.returnDate
    ? row('Return Date', fmt(d.returnDate)) + (d.returnTime ? row('Return Time', fmtT(d.returnTime)) : '')
    : '';
  const fareRows = d.estimatedDistance
    ? row('Est. Distance', `~${d.estimatedDistance} km`) +
      (d.estimatedFare ? row('Estimated Fare', `<strong style="color:#C8A45D;font-size:15px">CHF ${Number(d.estimatedFare).toLocaleString()}</strong>`) : '')
    : '';
  const notesBlock = d.notes
    ? `<tr><td colspan="2" style="padding:16px">
        <div style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 18px">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C8A45D;margin-bottom:6px">SPECIAL REQUESTS</div>
          <div style="font-size:13px;color:#9e9b93;line-height:1.6">${d.notes}</div>
        </div></td></tr>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Booking Confirmed</title></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">Your Swiss Elite transfer is confirmed ✓ Ref: ${d.ref}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;padding:40px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px">
    <div style="font-size:22px;font-weight:700;letter-spacing:5px;color:#fff">◆ SWISS <span style="color:#C8A45D">ELITE</span></div>
    <div style="font-size:9px;letter-spacing:6px;text-transform:uppercase;color:#5a5750;margin-top:6px">LUXURY CHAUFFEUR TRANSFERS</div>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden">
    <div style="height:1px;background:linear-gradient(90deg,#0d0d0d,#C8A45D,#0d0d0d)"></div>

    <!-- Ref banner -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:28px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:rgba(200,164,93,0.09);border:1px solid rgba(200,164,93,0.28);border-radius:12px;padding:18px 22px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#5a5750;margin-bottom:6px">BOOKING REFERENCE</div>
              <div style="font-size:24px;font-weight:700;color:#C8A45D;letter-spacing:3px">${d.ref}</div>
            </td>
            <td align="right" valign="middle">
              <div style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:20px;padding:7px 16px;display:inline-block">
                <span style="font-size:11px;font-weight:700;color:#4ade80;letter-spacing:1.5px">✓ CONFIRMED</span>
              </div>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr></table>

    <!-- Greeting -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:24px 28px 8px">
      <div style="font-size:19px;font-weight:600;color:#f0ede6;margin-bottom:10px">Dear ${d.name},</div>
      <div style="font-size:14px;color:#9e9b93;line-height:1.7">Your luxury transfer has been confirmed. A professional chauffeur will be ready at the pickup location. Please find your complete travel details below.</div>
    </td></tr></table>

    <!-- Route -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:12px">${isRound ? 'OUTBOUND ROUTE' : 'TRANSFER ROUTE'}</div>
      ${routeBlock('outbound', d.pickup, d.dropoff)}
      ${isRound ? `
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-top:20px;margin-bottom:12px">RETURN ROUTE</div>
      ${routeBlock('return', returnPickup, returnDropoff)}
      ` : ''}
    </td></tr></table>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 28px 20px">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:12px">BOOKING DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden">
        ${row('Passenger', d.name)}
        ${row('Phone', d.phone || '—')}
        ${row('Vehicle', d.vehicle || '—')}
        ${row('Trip Type', tripLabel)}
        ${row('Pickup Date', fmt(d.date))}
        ${row('Pickup Time', fmtT(d.time))}
        ${returnRows}
        ${fareRows}
        ${d.paymentMethod ? row('Payment', d.paymentMethod === 'online' ? '<span style="color:#4ade80;font-weight:700">✓ Paid Online</span>' : 'Cash on Arrival') : ''}
        ${notesBlock}
      </table>
    </td></tr></table>

    <!-- What to expect -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 28px 24px">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:12px">WHAT TO EXPECT</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:12px">
        <tr><td style="padding:14px 18px 4px"><table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="color:#C8A45D;font-size:12px;width:18px;vertical-align:top;padding-top:2px">◆</td>
          <td style="padding-left:10px;font-size:13px;color:#9e9b93;line-height:1.6">Your chauffeur will contact you <strong style="color:#f0ede6">30 minutes before pickup</strong> with their details.</td>
        </tr></table></td></tr>
        <tr><td style="padding:4px 18px"><table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="color:#C8A45D;font-size:12px;width:18px;vertical-align:top;padding-top:2px">◆</td>
          <td style="padding-left:10px;font-size:13px;color:#9e9b93;line-height:1.6">For changes, contact us at least <strong style="color:#f0ede6">24 hours in advance</strong>.</td>
        </tr></table></td></tr>
        <tr><td style="padding:4px 18px 14px"><table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="color:#C8A45D;font-size:12px;width:18px;vertical-align:top;padding-top:2px">◆</td>
          <td style="padding-left:10px;font-size:13px;color:#9e9b93;line-height:1.6">Keep this email as your confirmation. Reference: <strong style="color:#C8A45D">${d.ref}</strong></td>
        </tr></table></td></tr>
      </table>
    </td></tr></table>

    <!-- Footer bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:rgba(200,164,93,0.07);border-top:1px solid rgba(200,164,93,0.2);padding:18px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><div style="font-size:12px;color:#9e9b93">Email: <a href="mailto:info@swisselitetransfers.com" style="color:#C8A45D;text-decoration:none">info@swisselitetransfers.com</a></div></td>
        <td align="right"><div style="font-size:14px;font-weight:700;letter-spacing:3px;color:#fff">◆ SWISS <span style="color:#C8A45D">ELITE</span></div></td>
      </tr></table>
    </td></tr></table>
  </td></tr>

  <!-- Disclaimer -->
  <tr><td align="center" style="padding:20px 8px 0">
    <p style="font-size:11px;color:#3a3935;line-height:1.6;margin:0;text-align:center">
      This email was sent to ${d.email} because a booking was placed at book.swisselitetransfers.com.<br>
      Swiss Elite Chauffeur · Geneva, Switzerland
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* ── Admin notification email ─────────────────────────── */
function buildAdminEmail(d) {
  const isRound       = d.tripType === 'round-trip';
  const tripLabel     = isRound ? 'Round Trip' : 'One Way';
  const returnPickup  = d.returnPickup  || d.dropoff || '—';
  const returnDropoff = d.returnDropoff || d.pickup  || '—';
  const isPaid        = d.paymentMethod === 'online';
  const paymentBadge  = isPaid
    ? `<span style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35);color:#4ade80;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px">✓ PAID ONLINE</span>`
    : `<span style="background:rgba(200,164,93,0.10);border:1px solid rgba(200,164,93,0.30);color:#C8A45D;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px">CASH ON ARRIVAL</span>`;

  function arow(label, val) {
    return `<tr>
      <td style="padding:11px 18px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;white-space:nowrap;vertical-align:top;width:38%">${label}</td>
      <td style="padding:11px 18px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#f0ede6;font-weight:500;vertical-align:top">${val}</td>
    </tr>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Booking — ${d.ref}</title></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">New booking ${d.ref} — ${d.name} | ${d.pickup} → ${d.dropoff} | ${fmt(d.date)} ${fmtT(d.time)}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;padding:40px 16px"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 28px">
    <div style="font-size:22px;font-weight:700;letter-spacing:5px;color:#fff">◆ SWISS <span style="color:#C8A45D">ELITE</span></div>
    <div style="font-size:9px;letter-spacing:6px;text-transform:uppercase;color:#5a5750;margin-top:6px">NEW BOOKING NOTIFICATION</div>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:18px;overflow:hidden">
    <div style="height:1px;background:linear-gradient(90deg,#0d0d0d,#C8A45D,#0d0d0d)"></div>

    <!-- Ref + Payment badge -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:rgba(200,164,93,0.07);border:1px solid rgba(200,164,93,0.22);border-radius:12px;padding:16px 20px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#5a5750;margin-bottom:5px">BOOKING REFERENCE</div>
              <div style="font-size:24px;font-weight:700;color:#C8A45D;letter-spacing:3px">${d.ref}</div>
            </td>
            <td align="right" valign="middle">${paymentBadge}</td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr></table>

    <!-- Customer contact block -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:14px">CUSTOMER</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04)">
            <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;margin-bottom:4px">NAME</div>
            <div style="font-size:15px;font-weight:700;color:#f0ede6">${d.name}</div>
          </td>
          <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.04)">
            <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;margin-bottom:4px">PHONE</div>
            <div style="font-size:15px;font-weight:700;color:#f0ede6"><a href="tel:${d.phone||''}" style="color:#f0ede6;text-decoration:none">${d.phone || '—'}</a></div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 18px">
            <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#5a5750;margin-bottom:4px">EMAIL</div>
            <div style="font-size:13px;font-weight:500;color:#C8A45D"><a href="mailto:${d.email}" style="color:#C8A45D;text-decoration:none">${d.email}</a></div>
          </td>
        </tr>
      </table>
    </td></tr></table>

    <!-- Route -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:14px">${isRound ? 'OUTBOUND ROUTE' : 'TRANSFER ROUTE'}</div>
      ${routeBlock('outbound', d.pickup, d.dropoff)}
      ${isRound ? `
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-top:18px;margin-bottom:14px">RETURN ROUTE</div>
      ${routeBlock('return', returnPickup, returnDropoff)}
      ` : ''}
    </td></tr></table>

    <!-- Schedule -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:14px">SCHEDULE</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden">
        ${arow('Trip Type', tripLabel)}
        ${arow('Pickup Date', `<strong style="color:#f0ede6">${fmt(d.date)}</strong>`)}
        ${arow('Pickup Time', `<strong style="color:#C8A45D;font-size:14px">${fmtT(d.time)}</strong>`)}
        ${isRound && d.returnDate ? arow('Return Date', `<strong style="color:#f0ede6">${fmt(d.returnDate)}</strong>`) : ''}
        ${isRound && d.returnTime ? arow('Return Time', `<strong style="color:#C8A45D;font-size:14px">${fmtT(d.returnTime)}</strong>`) : ''}
      </table>
    </td></tr></table>

    <!-- Vehicle & Fare -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:14px">VEHICLE &amp; FARE</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden">
        ${arow('Vehicle', d.vehicle || '—')}
        ${d.estimatedDistance ? arow('Est. Distance', `~${d.estimatedDistance} km`) : ''}
        ${d.estimatedFare ? arow('Estimated Fare', `<strong style="color:#C8A45D;font-size:16px">CHF ${Number(d.estimatedFare).toLocaleString()}</strong>`) : ''}
        ${arow('Payment', isPaid ? '<span style="color:#4ade80;font-weight:700">✓ Paid Online</span>' : '<span style="color:#C8A45D">Cash on Arrival</span>')}
      </table>
    </td></tr></table>

    ${d.notes ? `
    <!-- Special Requests -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C8A45D;margin-bottom:14px">SPECIAL REQUESTS</div>
      <div style="background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 18px;font-size:13px;color:#9e9b93;line-height:1.7">${d.notes}</div>
    </td></tr></table>
    ` : ''}

    <!-- Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:rgba(200,164,93,0.06);border-top:1px solid rgba(200,164,93,0.18);padding:18px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:12px;color:#9e9b93">
          <a href="https://book.swisselitetransfers.com/admin/dashboard" style="color:#C8A45D;text-decoration:none;font-weight:600">Open Admin Dashboard →</a>
        </td>
        <td align="right">
          <div style="font-size:14px;font-weight:700;letter-spacing:3px;color:#fff">◆ SWISS <span style="color:#C8A45D">ELITE</span></div>
        </td>
      </tr></table>
    </td></tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
