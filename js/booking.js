/**
 * DR. PUJA'S CLINIC — booking.js  v3
 *
 * ── CONFIGURATION ────────────────────────────────────────────────────────────
 *
 *  GOOGLE CALENDAR  (real-time slot sync)
 *    1. console.cloud.google.com → new project → enable Calendar API
 *    2. Create OAuth2 credentials → Web Application
 *    3. Add https://drpujaprasad.in to Authorized origins
 *    Then: set enabled:true and paste clientId + apiKey below.
 *    Note: also add the gapi <script> tag to index.html when enabling.
 *
 *  GOOGLE SHEETS BACKEND  (cross-device booking persistence)
 *    Follow the AppsScript.gs setup guide.
 *    Then: set enabled:true and paste the deployed Web App URL below.
 *
 *  FORMSPREE  (contact form — free, no keys needed)
 *    1. https://formspree.io → free account → new form
 *    2. Copy the form endpoint (https://formspree.io/f/XXXXXXXX)
 *    Then: paste it into BOOKING_CONFIG.formspree.endpoint below.
 *
 *  WHATSAPP  — works immediately, no setup needed.
 */

'use strict';

// ── XSS SANITISER ─────────────────────────────────────────────────────────────
// Used on ALL user-controlled values before writing to innerHTML.
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

  googleCalendar: {
    clientId: 'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    calendarId: 'drpujasclinic@gmail.com',
    apiKey: 'YOUR_GOOGLE_API_KEY',
    enabled: false,
  },

  backend: {
    url: 'YOUR_APPS_SCRIPT_WEB_APP_URL', // ← paste after deployment
    enabled: false,
  },

  formspree: {
    endpoint: 'https://formspree.io/f/mojoygkl', // ← paste
    enabled: true, // set true once endpoint is filled
  },

  whatsapp: {
    patientPhone: '919899416040',
    doctorPhone: '919899416040', // clinic's own number for doctor notifications
    enabled: true,
  },

  clinic: {
    name: "Dr. Puja's Clinic",
    email: 'drpujasclinic@gmail.com',
    phone: '+91-9899416040',
  },
};

// ── LOCATION DATA ─────────────────────────────────────────────────────────────
// openDays: JS day-of-week numbers. 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const LOCATIONS = [
  {
    id: 'madhu-vihar',
    name: "Dr. Puja's Clinic, Madhu Vihar",
    address: 'A 128, Gali No 8, Sai Chowk, Madhu Vihar, IP Extension, Patparganj, New Delhi — 110092',
    short: 'A 128, Gali No 8, Madhu Vihar, Delhi',
    logo: 'images/logo.jpg',
    fee: '₹800',
    feeNum: 800,
    days: 'Mon–Sat 12–2 PM & 6–8:30 PM · Sunday 12–2 PM',
    openDays: [0, 1, 2, 3, 4, 5, 6],
    slots: {
      // Mon–Sat has both morning (noon) and evening sessions.
      // Sunday: noon session only — no evening.
      weekday: {
        morning: ['12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
          '01:00 PM', '01:15 PM', '01:30 PM', '01:45 PM'],
        evening: ['06:00 PM', '06:15 PM', '06:30 PM', '06:45 PM',
          '07:00 PM', '07:15 PM', '07:30 PM', '07:45 PM',
          '08:00 PM', '08:15 PM'],
      },
      sunday: {
        morning: ['12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
          '01:00 PM', '01:15 PM', '01:30 PM', '01:45 PM'],
        evening: [],
      },
    },
  },
  {
    id: 'pushpanjali',
    name: 'Pushpanjali Hospital',
    address: 'Karkardooma, Delhi',
    short: 'Karkardooma, Delhi',
    logo: 'images/logos/pushpanjali.png',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Wed & Sat · 10 AM–12 PM',
    openDays: [3, 6], // Wed, Sat
    slots: {
      morning: ['10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
        '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM'],
      evening: [],
    },
  },
  {
    id: 'max',
    name: 'Max Super Speciality Hospital',
    address: '108A, Indraprastha Extension, Patparganj',
    short: 'Indraprastha Extension, Patparganj, Delhi',
    logo: 'images/logos/max.png',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Tue 2–4 PM · Sun 9–11 AM',
    openDays: [0, 2], // Sun, Tue
    slots: {
      morning: ['09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM',
        '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM'],
      evening: ['02:00 PM', '02:15 PM', '02:30 PM', '02:45 PM',
        '03:00 PM', '03:15 PM', '03:30 PM', '03:45 PM'],
    },
  },
  {
    id: 'femmenest',
    name: 'Femmenest',
    address: 'Karkardooma, Delhi',
    short: 'Karkardooma, Delhi',
    logo: 'images/logos/femmenest.png',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Mon & Thu · 9–11 AM',
    openDays: [1, 4], // Mon, Thu
    slots: {
      morning: ['09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM',
        '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM'],
      evening: [],
    },
  },
];

// ── SLOT HELPERS ──────────────────────────────────────────────────────────────

// Returns the correct {morning, evening} slot set for a location + date.
// Enforces openDays restriction and vacation blocks.
function getSlotsForLocationOnDate(loc, dateStr) {
  if (!loc) return { morning: [], evening: [] };
  const dow = dateStr ? new Date(dateStr + 'T12:00:00').getDay() : new Date().getDay();

  // Day-of-week restriction
  if (loc.openDays && !loc.openDays.includes(dow)) return { morning: [], evening: [] };
  // Vacation block
  if (dateStr && isDateBlocked(dateStr)) return { morning: [], evening: [] };

  // Madhu Vihar has separate weekday/sunday slot sets
  if (loc.slots.weekday || loc.slots.sunday) {
    return dow === 0
      ? (loc.slots.sunday || { morning: [], evening: [] })
      : (loc.slots.weekday || { morning: [], evening: [] });
  }
  return loc.slots;
}

// Scans up to 14 days ahead and returns the earliest available {dateStr, time} for a location.
function findEarliestSlot(loc) {
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateStr = formatDateStr(d);
    const daySlots = getSlotsForLocationOnDate(loc, dateStr);
    const allSlots = [...(daySlots.morning || []), ...(daySlots.evening || [])];
    for (const time of allSlots) {
      if (i === 0 && isSlotInPast(time)) continue; // skip past times today
      if (!isSlotBooked(dateStr, loc.id, time)) return { dateStr, time };
    }
  }
  return null;
}

function isSlotInPast(time12hr) {
  const now = new Date();
  const [t, period] = time12hr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
}

function todayDateStr() { return formatDateStr(new Date()); }

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── LOCAL SLOT LOCKING (same-browser dedup until Google Calendar / backend is live) ──
const SLOT_LOCK_KEY = 'drpuja_booked_slots_v1';

function getLockedSlots() {
  try { return JSON.parse(localStorage.getItem(SLOT_LOCK_KEY)) || {}; }
  catch { return {}; }
}
function lockSlot(dateStr, locationId, time) {
  const locked = getLockedSlots();
  const key = `${dateStr}|${locationId || 'video'}`;
  if (!locked[key]) locked[key] = [];
  if (!locked[key].includes(time)) locked[key].push(time);
  try { localStorage.setItem(SLOT_LOCK_KEY, JSON.stringify(locked)); } catch { }
}
function isSlotBooked(dateStr, locationId, time) {
  const locked = getLockedSlots();
  const key = `${dateStr}|${locationId || 'video'}`;
  return (locked[key] || []).includes(time);
}

// ── VACATION / BLOCKED DATES ──────────────────────────────────────────────────
// Add 'YYYY-MM-DD' strings to the array below, OR manage from Google Sheet
// once BOOKING_CONFIG.backend.enabled = true (fetched via fetchBlockedDates).
let BLOCKED_DATES = [
  // '2026-08-15',   ← example: Independence Day
  // '2026-10-02',   ← example: Gandhi Jayanti
];

function isDateBlocked(dateStr) { return BLOCKED_DATES.includes(dateStr); }

async function fetchBlockedDates() {
  if (!BOOKING_CONFIG.backend?.enabled) return;
  try {
    const res = await fetch(`${BOOKING_CONFIG.backend.url}?action=getBlockedDates`);
    const data = await res.json();
    if (Array.isArray(data.blockedDates)) BLOCKED_DATES = data.blockedDates;
  } catch {
    // Silently use the fallback BLOCKED_DATES array above
  }
}

// ── BACKEND SAVE (Google Sheets) ──────────────────────────────────────────────
// Called by booking-widget.js's bwConfirm() after a booking is confirmed.
async function saveBookingToBackend() {
  if (!BOOKING_CONFIG.backend.enabled) return;
  // booking-widget.js passes its own widgetState shape; this stub is kept for
  // when BOOKING_CONFIG.backend.enabled is turned on with a real Apps Script URL.
}

// ── GOOGLE CALENDAR (booked-slot sync) ────────────────────────────────────────
async function fetchBookedSlots(dateStr, locationId) {
  if (!BOOKING_CONFIG.googleCalendar.enabled || !dateStr) return;
  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: BOOKING_CONFIG.googleCalendar.calendarId,
      timeMin: `${dateStr}T00:00:00+05:30`,
      timeMax: `${dateStr}T23:59:59+05:30`,
      singleEvents: true,
      orderBy: 'startTime',
    });
    (response.result.items || []).forEach(e => {
      const dt = new Date(e.start.dateTime);
      const time = dt.toLocaleTimeString('en-IN',
        { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      lockSlot(dateStr, locationId, time);
    });
  } catch { /* fall back to localStorage locks */ }
}

// ── CONTACT FORM (Formspree + WhatsApp fallback) ──────────────────────────────
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
    // Real delivery confirmed — show success
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Message Sent ✓', "We'll get back to you within 24 hours.");
  } else {
    // Formspree not configured or failed — redirect to WhatsApp with the message pre-filled
    const waText = `Hi Dr. Puja's Clinic!\n\nMessage via website:\nName: ${name}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`;
    window.open(
      `https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(waText)}`,
      '_blank', 'noopener,noreferrer'
    );
    // Show success anyway — WhatsApp is now carrying the message
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Redirected to WhatsApp', 'Your message has been pre-filled in WhatsApp. Please tap Send.');
  }
}

// ── NOTIFICATION TOAST ────────────────────────────────────────────────────────
function showNotification(title, msg) {
  const n = document.getElementById('notification');
  // Use textContent — never innerHTML — for notification content (user-supplied values)
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}

// ── LOCATIONS PAGE — earliest slot banners ────────────────────────────────────
function renderEarliestSlotBanners() {
  LOCATIONS.forEach(loc => {
    const el = document.getElementById('earliestSlot_' + loc.id);
    if (!el) return;
    const earliest = findEarliestSlot(loc);
    if (earliest) {
      const dl = new Date(earliest.dateStr + 'T12:00:00')
        .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      // textContent — safe, no HTML injection
      el.textContent = `Earliest available: ${earliest.time}, ${dl}.`;
    } else {
      el.textContent = 'No slots available in the next 14 days.';
    }
  });
}

// ── AUTO-INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchBlockedDates().then(renderEarliestSlotBanners);
  renderEarliestSlotBanners(); // immediate render, refines after blocked dates load
});
