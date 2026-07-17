/**
 * DR. PUJA'S CLINIC — booking.js  v4
 * Now backed by the real PHP/MySQL API instead of localStorage + demo OTP.
 * See backend/API.md for the full endpoint reference.
 */

'use strict';

// ── XSS SANITISER ─────────────────────────────────────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── CONFIG ────────────────────────────────────────────────────────────────────
const BOOKING_CONFIG = {
  formspree: {
    endpoint: 'https://formspree.io/f/mojoygkl',
    enabled: true,
  },
  whatsapp: {
    patientPhone: '919899416040',
    doctorPhone: '919899416040',
    enabled: true,
  },
  clinic: {
    name: "Dr. Puja's Clinic",
    email: 'drpujasclinic@gmail.com',
    phone: '+91-9899416040',
  },
};

// ── API BASE ──────────────────────────────────────────────────────────────────
// Same-origin — /api/*.php, served either directly or via the router stubs
// described in backend/README.md.
const API_BASE = '/api';

/**
 * Shared fetch wrapper for every backend call. Always sends credentials
 * (session + remember-device cookies) and the X-Requested-With header the
 * backend requires as a lightweight CSRF check on state-changing endpoints.
 * Returns the parsed JSON body regardless of HTTP status — callers check
 * `.success` themselves, since error responses are still valid JSON with
 * useful `.error` / `.code` fields.
 */
async function bwApi(path, { method = 'GET', body = null } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, opts);
  } catch (networkErr) {
    return { success: false, error: 'Could not reach the server. Please check your connection and try again.', code: 'network_error' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { success: false, error: 'Unexpected response from the server. Please try again.', code: 'bad_response' };
  }
  return data;
}

// ── LOCATION DISPLAY DATA ──────────────────────────────────────────────────────
// This is display metadata ONLY now — slugs must match clinic_locations.slug
// in the database exactly. Scheduling, availability, and fees-of-record all
// live server-side (backend/database/schema.sql); fee here is a display
// fallback only, shown before the API responds.
const LOCATIONS = [
  {
    id: 'madhu-vihar',
    name: "Dr. Puja's Clinic, Madhu Vihar",
    address: 'A 128, Gali No 8, Sai Chowk, Madhu Vihar, IP Extension, Patparganj, New Delhi — 110092',
    short: 'A 128, Gali No 8, Madhu Vihar, Delhi',
    logo: 'images/logo.jpg',
    fee: '₹800',
  },
  {
    id: 'pushpanjali',
    name: 'Pushpanjali Hospital',
    address: 'Karkardooma, Delhi',
    short: 'Karkardooma, Delhi',
    logo: 'images/logos/pushpanjali.png',
    fee: '₹1,000',
  },
  {
    id: 'max',
    name: 'Max Super Speciality Hospital',
    address: '108A, Indraprastha Extension, Patparganj',
    short: 'Indraprastha Extension, Patparganj, Delhi',
    logo: 'images/logos/max.png',
    fee: '₹1,000',
  },
  {
    id: 'femmenest',
    name: 'Femmenest',
    address: 'Karkardooma, Delhi',
    short: 'Karkardooma, Delhi',
    logo: 'images/logos/femmenest.png',
    fee: '₹1,000',
  },
];

function findLocation(slug) {
  return LOCATIONS.find(l => l.id === slug) || null;
}

// ── DATE HELPERS (display only — availability is server-side now) ────────────
function todayDateStr() { return formatDateStr(new Date()); }

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── CONTACT FORM (Formspree + WhatsApp fallback) — unchanged, not part of booking ──
async function submitContactForm(e) {
  e.preventDefault();
  const consent = document.getElementById('contactConsent');
  if (!consent.checked) {
    alert('Please accept the consent checkbox before submitting.');
    return;
  }

  const name = document.getElementById('cName').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const subject = document.getElementById('cSubject').value;
  const message = document.getElementById('cMessage').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

  let sent = false;
  if (BOOKING_CONFIG.formspree.enabled) {
    try {
      const res = await fetch(BOOKING_CONFIG.formspree.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      if (res.ok) sent = true;
    } catch { }
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }

  if (sent) {
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Message Sent ✓', "We'll get back to you within 24 hours.");
  } else {
    const waText = `Hi Dr. Puja's Clinic!\n\nMessage via website:\nName: ${name}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`;
    window.open(
      `https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(waText)}`,
      '_blank', 'noopener,noreferrer'
    );
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Redirected to WhatsApp', 'Your message has been pre-filled in WhatsApp. Please tap Send.');
  }
}

// ── NOTIFICATION TOAST ────────────────────────────────────────────────────────
function showNotification(title, msg) {
  const n = document.getElementById('notification');
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}

// ── LOCATIONS PAGE — earliest slot banners ────────────────────────────────────
async function renderEarliestSlotBanners() {
  for (const loc of LOCATIONS) {
    const el = document.getElementById('earliestSlot_' + loc.id);
    if (!el) continue;
    el.textContent = 'Checking availability…';

    const res = await bwApi(`/availability-summary.php?location=${loc.id}&type=in_person&days=14`);
    if (!res.success) { el.textContent = ''; continue; }

    const firstOpen = Object.entries(res.summary).find(([, info]) => info.available > 0);
    if (!firstOpen) {
      el.textContent = 'No slots available in the next 14 days.';
      continue;
    }
    const [date] = firstOpen;
    const slotsRes = await bwApi(`/check-slots.php?location=${loc.id}&date=${date}&type=in_person`);
    const firstTime = slotsRes.success ? (slotsRes.slots.morning[0] || slotsRes.slots.evening[0]) : null;
    const dl = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    el.textContent = firstTime ? `Earliest available: ${firstTime}, ${dl}.` : `Available ${dl}.`;
  }
}

// ── AUTO-INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderEarliestSlotBanners();
});
