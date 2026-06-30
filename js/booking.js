/**
 * DR. PUJA'S CLINIC — Booking System v2
 *
 * CONFIGURATION — fill in your keys before deploying:
 *
 *  EMAILJS:
 *    1. Create account at https://emailjs.com
 *    2. Add a service (Gmail is easiest) → copy Service ID
 *    3. Create email template → copy Template ID
 *    4. Copy your Public Key from Account → API Keys
 *
 *  GOOGLE CALENDAR:
 *    1. Go to https://console.cloud.google.com
 *    2. Create project → enable "Google Calendar API"
 *    3. Create OAuth2 credentials → Web Application
 *    4. Add https://your-domain.com to Authorized origins
 *    5. Load the Google API client (gapi) in index.html
 *
 *  WHATSAPP:
 *    No API key needed for basic wa.me redirect.
 *    For full Business API (Twilio), add TWILIO_WHATSAPP_URL below.
 */

const BOOKING_CONFIG = {
  // ─── EmailJS ───────────────────────────────────────────────────────
  emailjs: {
    publicKey:    'YOUR_EMAILJS_PUBLIC_KEY',       // ← paste here
    serviceId:    'YOUR_EMAILJS_SERVICE_ID',        // ← paste here
    templateId:   'YOUR_EMAILJS_TEMPLATE_ID',       // ← paste here
    enabled: false,  // set to true once keys are filled
  },

  // ─── Google Calendar ───────────────────────────────────────────────
  googleCalendar: {
    clientId:     'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    calendarId:   'drpujasclinic@gmail.com',
    apiKey:       'YOUR_GOOGLE_API_KEY',
    enabled: false,  // set to true once keys are filled
  },

  // ─── WhatsApp ──────────────────────────────────────────────────────
  whatsapp: {
    phone: '919899416040',
    enabled: true,   // works without any API key
  },

  // ─── Backend (Google Sheets via Apps Script Web App) ────────────────
  // This is what makes bookings persist across all devices/browsers,
  // instead of just the localStorage lock on one device.
  // See setup instructions provided separately — paste your deployed
  // Apps Script Web App URL below and set enabled: true.
  backend: {
    url: 'YOUR_APPS_SCRIPT_WEB_APP_URL', // ← paste here after deployment
    enabled: false,  // set to true once URL is filled
  },

  // ─── Clinic info ──────────────────────────────────────────────────
  clinic: {
    name:  "Dr. Puja's Clinic",
    email: 'drpujasclinic@gmail.com',
    phone: '+91-9899416040',
  },
};

// ─── Location data ─────────────────────────────────────────────────────────
const LOCATIONS = [
  {
    id: 'madhu-vihar',
    name: "Dr. Puja's Clinic, Madhu Vihar",
    address: 'A 128, Gali No 8, Sai Chowk, Madhu Vihar, IP Extension, Patparganj, New Delhi — 110092',
    fee: '₹800',
    feeNum: 800,
    days: 'Mon – Sat & Sunday (12 PM – 2 PM only)',
    openDays: [0, 1, 2, 3, 4, 5, 6], // every day
    slots: {
      // Mon–Sat: 12:00–2:00 PM and 6:00–8:30 PM. Sunday: 12:00–2:00 PM only (no evening).
      weekday: {
        morning: ['12:00 PM','12:15 PM','12:30 PM','12:45 PM','01:00 PM','01:15 PM','01:30 PM','01:45 PM'],
        evening: ['06:00 PM','06:15 PM','06:30 PM','06:45 PM','07:00 PM','07:15 PM','07:30 PM','07:45 PM','08:00 PM','08:15 PM'],
      },
      sunday: {
        morning: ['12:00 PM','12:15 PM','12:30 PM','12:45 PM','01:00 PM','01:15 PM','01:30 PM','01:45 PM'],
        evening: [],
      },
    },
  },
  {
    id: 'pushpanjali',
    name: 'Pushpanjali Hospital',
    address: 'Karkardooma, Delhi',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Wed & Sat, 10 AM – 12 PM',
    openDays: [3, 6], // Wed, Sat
    slots: {
      morning: ['10:00 AM','10:15 AM','10:30 AM','10:45 AM','11:00 AM','11:15 AM','11:30 AM','11:45 AM'],
      evening: [],
    },
  },
  {
    id: 'max',
    name: 'Max Super Speciality Hospital',
    address: '108A, Indraprastha Extension, Patparganj',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Tue 2–4 PM, Sun 9–11 AM',
    openDays: [0, 2], // Sun, Tue
    slots: {
      morning: ['09:00 AM','09:15 AM','09:30 AM','09:45 AM','10:00 AM','10:15 AM','10:30 AM','10:45 AM'],
      evening: ['02:00 PM','02:15 PM','02:30 PM','02:45 PM','03:00 PM','03:15 PM','03:30 PM','03:45 PM'],
    },
  },
  {
    id: 'femmenest',
    name: 'Femmenest',
    address: 'Karkardooma, Delhi',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Mon & Thu, 9–11 AM',
    openDays: [1, 4], // Mon, Thu
    slots: {
      morning: ['09:00 AM','09:15 AM','09:30 AM','09:45 AM','10:00 AM','10:15 AM','10:30 AM','10:45 AM'],
      evening: [],
    },
  },
];

// ─── State ─────────────────────────────────────────────────────────────────
let bookingState = {
  type: null,          // 'clinic' | 'video'
  location: null,      // LOCATIONS entry
  date: null,          // 'YYYY-MM-DD'
  time: null,          // '10:00 AM'
  name: '',
  phone: '',
  email: '',
  reason: '',
  // Runtime
  step: 1,
  bookedSlots: [],     // fetched from Google Calendar or mock
  isLoading: false,
};

// ─── Init ──────────────────────────────────────────────────────────────────
function initBooking() {
  if (BOOKING_CONFIG.emailjs.enabled) {
    emailjs.init(BOOKING_CONFIG.emailjs.publicKey);
  }
}

function openBooking(locationId) {
  const overlay = document.getElementById('bookingOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetBookingState();
  if (locationId) {
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (loc) {
      bookingState.type = 'clinic';
      bookingState.location = loc;
      renderStep(3); // skip type + location steps, go straight to date/time for this hospital
      return;
    }
  }
  renderStep(1);
}

function closeBooking() {
  document.getElementById('bookingOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function resetBookingState() {
  bookingState = {
    type: null, location: null, date: null, time: null,
    name: '', phone: '', email: '', reason: '',
    step: 1, bookedSlots: [], isLoading: false,
  };
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  const label = document.getElementById('step1NextLabel');
  if (label) label.textContent = 'Next: Choose Location →';
  const banner = document.getElementById('earliestSlotBanner');
  if (banner) banner.style.display = 'none';
}

// ─── STEP ROUTER ──────────────────────────────────────────────────────────
function renderStep(step) {
  bookingState.step = step;
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`bookStep${step}`);
  if (el) el.classList.add('active');
  updateStepIndicator(step);
  // Special pre-renders
  if (step === 2 && bookingState.type === 'clinic') renderLocationStep();
  if (step === 3) renderDateTimeStep();
  if (step === 4) renderSummaryStep();
}

function updateStepIndicator(activeStep) {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`stepDot${i}`);
    if (!dot) continue;
    dot.className = 'step-dot';
    if (i < activeStep) { dot.classList.add('done'); dot.textContent = ''; }
    else if (i === activeStep) { dot.classList.add('active'); dot.textContent = i; }
    else { dot.textContent = i; }
    const line = document.getElementById(`stepLine${i}`);
    if (line) line.className = 'step-line' + (i < activeStep ? ' done' : '');
  }
}

// ─── STEP 1: TYPE ─────────────────────────────────────────────────────────
function selectConsultationType(type) {
  bookingState.type = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`typeCard_${type}`).classList.add('selected');
  document.getElementById('step1Next').classList.remove('btn-disabled');
  document.getElementById('step1Next').removeAttribute('disabled');
  document.getElementById('step1NextLabel').textContent =
    type === 'video' ? 'Next: Choose Date & Time →' : 'Next: Choose Location →';
}

function goStep1Next() {
  if (!bookingState.type) return;
  if (bookingState.type === 'video') {
    // Video — skip location, go straight to date/time
    renderStep(3);
  } else {
    renderStep(2);
  }
}

// ─── STEP 2: LOCATION ─────────────────────────────────────────────────────
function renderLocationStep() {
  const container = document.getElementById('locationOptionsList');
  container.innerHTML = LOCATIONS.map(loc => `
    <div class="location-option ${bookingState.location?.id === loc.id ? 'selected' : ''}"
         onclick="selectLocation('${loc.id}')">
      <div>
        <div class="location-option-name">${loc.name}</div>
        <div class="location-option-detail">${loc.days} · ${loc.address.split(',')[0]}</div>
      </div>
      <div class="location-option-fee">${loc.fee}</div>
    </div>
  `).join('');
  checkStep2();
}

function selectLocation(locId) {
  bookingState.location = LOCATIONS.find(l => l.id === locId);
  bookingState.date = null;
  bookingState.time = null;
  renderLocationStep();
}

function checkStep2() {
  const btn = document.getElementById('step2Next');
  if (!btn) return;
  if (bookingState.location) {
    btn.classList.remove('btn-disabled');
    btn.removeAttribute('disabled');
  } else {
    btn.classList.add('btn-disabled');
    btn.setAttribute('disabled', '');
  }
}

// ─── STEP 3: DATE & TIME ──────────────────────────────────────────────────
function renderDateTimeStep() {
  if (bookingState.type === 'video') {
    document.getElementById('step3Title').textContent = 'Choose a Date & Time';
    document.getElementById('step3LocationLabel').textContent = 'Video Consultation';
  } else {
    document.getElementById('step3Title').textContent = 'Choose Date & Time';
    document.getElementById('step3LocationLabel').textContent = bookingState.location?.name || '';
  }

  // For video: auto-select the earliest available slot (pulled from Madhu Vihar timings)
  const earliestBanner = document.getElementById('earliestSlotBanner');
  if (bookingState.type === 'video' && !bookingState.date) {
    const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
    const earliest = findEarliestSlot(madhuVihar);
    if (earliest) {
      bookingState.date = earliest.dateStr;
      bookingState.time = earliest.time;
      if (earliestBanner) {
        const dateLabel = new Date(earliest.dateStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
        earliestBanner.textContent = `Earliest available slot is ${earliest.time} on ${dateLabel}.`;
        earliestBanner.style.display = 'block';
      }
    }
  } else if (earliestBanner) {
    earliestBanner.style.display = 'none';
  }

  buildCalendar();
  if (BOOKING_CONFIG.googleCalendar.enabled) {
    fetchBookedSlots();
  } else if (bookingState.date) {
    renderTimeSlots();
  }
  checkStep3();
}

// Finds the earliest available (unbooked) date+time for a location, scanning up to 14 days ahead.
function findEarliestSlot(loc) {
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const daySlots = getSlotsForLocationOnDate(loc, dateStr);
    const allSlots = [...(daySlots.morning || []), ...(daySlots.evening || [])];
    for (const time of allSlots) {
      // Skip slots already past for today
      if (i === 0 && isSlotInPast(time)) continue;
      if (!isSlotBooked(dateStr, loc.id, time)) {
        return { dateStr, time };
      }
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

function todayDateStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function buildCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const activeLoc = bookingState.type === 'video' ? madhuVihar : bookingState.location;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <span style="font-size:14px;font-weight:600;color:var(--ink);">${monthNames[month]} ${year}</span>
  </div>
  <div class="calendar-grid">`;
  days.forEach(d => { html += `<div class="cal-header">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSelected = bookingState.date === dateStr;
    const isToday = date.toDateString() === now.toDateString();

    // Check if this location has any slots left on this date
    const daySlots = activeLoc ? getSlotsForLocationOnDate(activeLoc, dateStr) : { morning: [], evening: [] };
    let allSlots = [...(daySlots.morning || []), ...(daySlots.evening || [])];
    if (isToday) allSlots = allSlots.filter(t => !isSlotInPast(t));
    const isClosed = activeLoc && allSlots.length === 0;

    const isDisabled = isPast || isClosed;
    let cls = 'cal-day';
    if (isDisabled) cls += ' disabled';
    else if (isSelected) cls += ' selected';
    else if (isToday) cls += ' today';
    const click = isDisabled ? '' : `onclick="selectDate('${dateStr}')"`;
    const title = isClosed && !isPast ? ` title="Not available at this location on this date"` : '';
    html += `<div class="${cls}" ${click}${title}>${d}</div>`;
  }
  html += '</div>';
  document.getElementById('calendarContainer').innerHTML = html;
}

function selectDate(dateStr) {
  bookingState.date = dateStr;
  bookingState.time = null;
  buildCalendar();
  renderTimeSlots();
}

function renderTimeSlots() {
  const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const loc = bookingState.type === 'video' ? madhuVihar : bookingState.location;
  const daySlots = getSlotsForLocationOnDate(loc, bookingState.date);
  let allSlots = [...(daySlots.morning || []), ...(daySlots.evening || [])];

  const isToday = bookingState.date === todayDateStr();
  if (isToday) allSlots = allSlots.filter(t => !isSlotInPast(t));

  const slotsEl = document.getElementById('slotsGrid');
  if (allSlots.length === 0) {
    const msg = isToday
      ? 'No remaining slots today at this location. Please choose another date.'
      : 'No slots available on this date. Please choose another date.';
    slotsEl.innerHTML = `<div style="grid-column:1/-1;font-size:13px;color:var(--ink-faint);text-align:center;padding:12px 0;">${msg}</div>`;
    document.getElementById('slotsContainer').style.display = 'block';
    checkStep3();
    return;
  }
  slotsEl.innerHTML = allSlots.map(s => {
    const isBooked = isSlotBooked(bookingState.date, loc?.id, s);
    const isSelected = bookingState.time === s;
    let cls = 'time-slot';
    if (isBooked) cls += ' booked';
    else if (isSelected) cls += ' selected';
    return `<div class="${cls}" ${!isBooked ? `onclick="selectSlot('${s}')"` : ''}>${s}</div>`;
  }).join('');
  document.getElementById('slotsContainer').style.display = 'block';
  checkStep3();
}

// ─── LOCAL SLOT LOCKING (dedup, same-browser only until Google Calendar is live) ──
const SLOT_LOCK_KEY = 'drpuja_booked_slots';

function getLockedSlots() {
  try { return JSON.parse(localStorage.getItem(SLOT_LOCK_KEY)) || {}; }
  catch { return {}; }
}
function lockSlot(dateStr, locationId, time) {
  const locked = getLockedSlots();
  const key = `${dateStr}|${locationId || 'video'}`;
  if (!locked[key]) locked[key] = [];
  if (!locked[key].includes(time)) locked[key].push(time);
  localStorage.setItem(SLOT_LOCK_KEY, JSON.stringify(locked));
}
function isSlotBooked(dateStr, locationId, time) {
  const locked = getLockedSlots();
  const key = `${dateStr}|${locationId || 'video'}`;
  return (locked[key] || []).includes(time);
}

// ─── VACATION / BLOCKED DATES ──────────────────────────────────────────────
// Dates Dr. Puja is unavailable (e.g. on leave). Add 'YYYY-MM-DD' strings here
// as a fallback, OR manage them live from the "Blocked Dates" tab of the
// Google Sheet once BOOKING_CONFIG.backend.enabled is true (see fetchBlockedDates).
let BLOCKED_DATES = [
  // '2026-07-15',
];

function isDateBlocked(dateStr) {
  return BLOCKED_DATES.includes(dateStr);
}

async function fetchBlockedDates() {
  if (!BOOKING_CONFIG.backend?.enabled) return;
  try {
    const res = await fetch(`${BOOKING_CONFIG.backend.url}?action=getBlockedDates`);
    const data = await res.json();
    if (Array.isArray(data.blockedDates)) BLOCKED_DATES = data.blockedDates;
  } catch {
    // Keep using whatever BLOCKED_DATES already holds (fallback list above)
  }
}

function selectSlot(time) {
  bookingState.time = time;
  renderTimeSlots();
}

// Returns the {morning, evening} slot set for a location on a given date string (YYYY-MM-DD).
// Handles locations with a single flat slot set, and Madhu Vihar's weekday/Sunday split.
// Enforces openDays (day-of-week restriction) and blocked vacation dates.
function getSlotsForLocationOnDate(loc, dateStr) {
  if (!loc) return { morning: [], evening: [] };
  const dow = dateStr ? new Date(dateStr + 'T12:00:00').getDay() : new Date().getDay();

  if (loc.openDays && !loc.openDays.includes(dow)) return { morning: [], evening: [] };
  if (dateStr && isDateBlocked(dateStr)) return { morning: [], evening: [] };

  if (loc.slots.weekday || loc.slots.sunday) {
    return dow === 0 ? (loc.slots.sunday || { morning: [], evening: [] })
                      : (loc.slots.weekday || { morning: [], evening: [] });
  }
  return loc.slots;
}

function checkStep3() {
  const btn = document.getElementById('step3Next');
  if (!btn) return;
  const valid = bookingState.date && bookingState.time;
  if (valid) { btn.classList.remove('btn-disabled'); btn.removeAttribute('disabled'); }
  else { btn.classList.add('btn-disabled'); btn.setAttribute('disabled', ''); }
}

// ─── STEP 4: DETAILS & CONFIRM ────────────────────────────────────────────
function renderSummaryStep() {
  const nameEl = document.getElementById('bName');
  const phoneEl = document.getElementById('bPhone');
  if (nameEl) nameEl.value = bookingState.name;
  if (phoneEl) phoneEl.value = bookingState.phone;
}

function validateDetails() {
  const name = document.getElementById('bName').value.trim();
  const phone = document.getElementById('bPhone').value.trim();
  const email = document.getElementById('bEmail').value.trim();
  let valid = true;

  [{ id: 'bName', val: name, msg: 'Name is required' },
   { id: 'bPhone', val: phone, msg: 'Phone number is required' }].forEach(f => {
    const el = document.getElementById(f.id);
    const err = document.getElementById(f.id + 'Error');
    if (!f.val) { el.classList.add('error'); if (err) err.textContent = f.msg; valid = false; }
    else { el.classList.remove('error'); if (err) err.textContent = ''; }
  });

  if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
    document.getElementById('bPhone').classList.add('error');
    document.getElementById('bPhoneError').textContent = 'Enter a valid 10-digit Indian mobile number';
    valid = false;
  }

  if (valid) {
    bookingState.name = name;
    bookingState.phone = phone;
    bookingState.email = email;
    bookingState.reason = document.getElementById('bReason')?.value || '';
    showConfirmStep();
  }
}

function showConfirmStep() {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('bookStepConfirm').classList.add('active');
  renderConfirmSummary();
}

function renderConfirmSummary() {
  const s = bookingState;
  const dateLabel = s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—';
  const rows = [
    { label: 'Patient', value: s.name },
    { label: 'Phone', value: s.phone },
    s.email ? { label: 'Email', value: s.email } : null,
    { label: 'Type', value: s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit' },
    s.location ? { label: 'Location', value: s.location.name } : null,
    s.date ? { label: 'Date', value: dateLabel } : null,
    s.time ? { label: 'Time', value: s.time } : null,
    { label: 'Fee', value: s.type === 'video' ? '₹800' : (s.location?.fee || '₹800') },
  ].filter(Boolean);
  document.getElementById('confirmSummaryRows').innerHTML = rows.map(r =>
    `<div class="summary-row"><span class="summary-label">${r.label}</span><span class="summary-value">${r.value}</span></div>`
  ).join('');
}

// ─── CONFIRM & SUBMIT ─────────────────────────────────────────────────────
async function confirmBooking() {
  const consent = document.getElementById('bookingConsent');
  if (!consent.checked) { showNotification('⚠️ Consent Required', 'Please accept the consent to continue.'); return; }

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  // Lock this slot so it can't be double-booked from this browser
  const lockLocId = bookingState.type === 'video' ? 'madhu-vihar' : bookingState.location?.id;
  lockSlot(bookingState.date, lockLocId, bookingState.time);

  const integrations = document.getElementById('integrationStatus');
  integrations.innerHTML = '';

  const addStatus = (id, label, state) => {
    integrations.innerHTML += `<div class="integration-row ${state}" id="intRow_${id}">
      ${state === 'sending' ? spinnerSVG() : state === 'sent' ? checkSVG() : crossSVG()}
      <span>${label}</span>
    </div>`;
  };
  const updateStatus = (id, state, label) => {
    const row = document.getElementById(`intRow_${id}`);
    if (row) {
      row.className = `integration-row ${state}`;
      row.innerHTML = `${state === 'sent' ? checkSVG() : crossSVG()} <span>${label}</span>`;
    }
  };

  // Run integrations in parallel
  const tasks = [];

  // 1. EmailJS confirmation
  if (BOOKING_CONFIG.emailjs.enabled && bookingState.email) {
    addStatus('email', 'Sending confirmation email…', 'sending');
    tasks.push(sendEmailConfirmation()
      .then(() => updateStatus('email', 'sent', 'Confirmation email sent'))
      .catch(() => updateStatus('email', 'failed', 'Email delivery failed — check your inbox later')));
  }

  // 2. WhatsApp notification
  if (BOOKING_CONFIG.whatsapp.enabled) {
    addStatus('wa', 'Preparing WhatsApp message…', 'sending');
    tasks.push(new Promise(resolve => {
      setTimeout(() => {
        updateStatus('wa', 'sent', 'WhatsApp confirmation ready');
        resolve();
      }, 600);
    }));
  }

  // 3. Google Calendar event
  if (BOOKING_CONFIG.googleCalendar.enabled && bookingState.date && bookingState.time) {
    addStatus('cal', "Adding to Dr. Puja's calendar…", 'sending');
    tasks.push(createCalendarEvent()
      .then(() => updateStatus('cal', 'sent', 'Calendar event created'))
      .catch(() => updateStatus('cal', 'failed', 'Calendar sync failed — clinic has been notified')));
  }

  await Promise.allSettled(tasks);

  // Done — show success screen
  btn.disabled = false;
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('bookStepSuccess').classList.add('active');
  document.querySelectorAll('.step-dot').forEach(d => { d.className = 'step-dot done'; d.textContent = ''; });
  document.querySelectorAll('.step-line').forEach(l => l.classList.add('done'));

  const s = bookingState;
  const dateLabel = s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) : 'Video (flexible)';
  document.getElementById('confirmSummaryFinal').innerHTML = `
    <strong>${s.name}</strong><br>
    ${s.type === 'video' ? 'Video Consultation' : s.location?.name || ''}<br>
    ${dateLabel}${s.time ? ' · ' + s.time : ''}<br>
    Fee: ${s.type === 'video' ? '₹800' : (s.location?.fee || '₹800')}
  `;

  // WhatsApp auto-open after 1.5s
  if (BOOKING_CONFIG.whatsapp.enabled) {
    setTimeout(() => {
      const msg = buildWhatsAppMessage();
      window.open(`https://wa.me/${BOOKING_CONFIG.whatsapp.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }, 1500);
  }

  showNotification('Booking Confirmed ✓', `Appointment confirmed for ${bookingState.name}. WhatsApp confirmation opening…`);
}

// ─── EMAIL ─────────────────────────────────────────────────────────────────
async function sendEmailConfirmation() {
  if (!BOOKING_CONFIG.emailjs.enabled) return;
  const s = bookingState;
  const dateLabel = s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : 'Video call (flexible)';
  const params = {
    to_name:       s.name,
    to_email:      s.email,
    appointment_type: s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit',
    location:      s.location?.name || 'Video Call',
    date:          dateLabel,
    time:          s.time || 'To be confirmed',
    fee:           s.type === 'video' ? '₹800' : (s.location?.fee || '₹800'),
    clinic_phone:  BOOKING_CONFIG.clinic.phone,
    clinic_name:   BOOKING_CONFIG.clinic.name,
    reason:        s.reason || 'General consultation',
  };
  return emailjs.send(BOOKING_CONFIG.emailjs.serviceId, BOOKING_CONFIG.emailjs.templateId, params);
}

// ─── GOOGLE CALENDAR ───────────────────────────────────────────────────────
async function createCalendarEvent() {
  if (!BOOKING_CONFIG.googleCalendar.enabled) return;
  const s = bookingState;
  const startISO = toISO(s.date, s.time);
  const endISO   = toISO(s.date, addMinutes(s.time, 15));
  const event = {
    summary: `Appointment – ${s.name} [${s.type === 'video' ? 'Video' : 'Clinic'}]`,
    description: [
      `Patient: ${s.name}`,
      `Phone: ${s.phone}`,
      `Email: ${s.email || 'N/A'}`,
      `Type: ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
      `Location: ${s.location?.name || 'Video Call'}`,
      `Fee: ${s.type === 'video' ? '₹800' : s.location?.fee}`,
      s.reason ? `Reason: ${s.reason}` : '',
    ].filter(Boolean).join('\n'),
    start: { dateTime: startISO, timeZone: 'Asia/Kolkata' },
    end:   { dateTime: endISO,   timeZone: 'Asia/Kolkata' },
    attendees: s.email ? [{ email: s.email }] : [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };
  // Requires gapi loaded and user signed in
  return gapi.client.calendar.events.insert({
    calendarId: BOOKING_CONFIG.googleCalendar.calendarId,
    resource: event,
  });
}

async function fetchBookedSlots() {
  if (!BOOKING_CONFIG.googleCalendar.enabled || !bookingState.date) return;
  const lockLocId = bookingState.type === 'video' ? 'madhu-vihar' : bookingState.location?.id;
  try {
    const timeMin = `${bookingState.date}T00:00:00+05:30`;
    const timeMax = `${bookingState.date}T23:59:59+05:30`;
    const response = await gapi.client.calendar.events.list({
      calendarId: BOOKING_CONFIG.googleCalendar.calendarId,
      timeMin, timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = response.result.items || [];
    events.forEach(e => {
      const dt = new Date(e.start.dateTime);
      const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      lockSlot(bookingState.date, lockLocId, time);
    });
  } catch {
    // Network/API failure — fall back to whatever is already locked locally
  }
  renderTimeSlots();
}

// ─── WHATSAPP ──────────────────────────────────────────────────────────────
function buildWhatsAppMessage() {
  const s = bookingState;
  const dateLabel = s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) : 'Video (flexible)';
  return [
    `Hi Dr. Puja's Clinic! 🙏`,
    `I'd like to confirm my appointment:`,
    ``,
    `👤 Name: ${s.name}`,
    `📱 Phone: ${s.phone}`,
    `📋 Type: ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
    s.location ? `📍 Location: ${s.location.name}` : '',
    s.date ? `📅 Date: ${dateLabel}` : '',
    s.time ? `⏰ Time: ${s.time}` : '',
    `💰 Fee: ${s.type === 'video' ? '₹800' : s.location?.fee || '₹800'}`,
    s.reason ? `💬 Reason: ${s.reason}` : '',
  ].filter(Boolean).join('\n');
}

// ─── CONTACT FORM ─────────────────────────────────────────────────────────
function submitContactForm(e) {
  e.preventDefault();
  const consent = document.getElementById('contactConsent');
  if (!consent.checked) { alert('Please accept the consent to proceed.'); return; }

  const name = document.getElementById('cName').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const message = document.getElementById('cMessage').value.trim();

  if (BOOKING_CONFIG.emailjs.enabled && email) {
    emailjs.send(BOOKING_CONFIG.emailjs.serviceId, BOOKING_CONFIG.emailjs.templateId, {
      to_name: "Dr. Puja's Clinic",
      to_email: BOOKING_CONFIG.clinic.email,
      from_name: name,
      from_email: email,
      phone,
      message,
    }).catch(() => {});
  }

  document.getElementById('contactForm').style.display = 'none';
  document.getElementById('contactSuccess').style.display = 'block';
  showNotification('Message Sent ✓', "We'll get back to you within 24 hours.");
}

// ─── NOTIFICATION ──────────────────────────────────────────────────────────
function showNotification(title, msg) {
  const n = document.getElementById('notification');
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}

// ─── TIME HELPERS ─────────────────────────────────────────────────────────
function to24hr(timeStr) {
  if (!timeStr) return '10:00';
  const [time, period] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function addMinutes(timeStr, mins) {
  if (!timeStr) return null;
  const [time, period] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  const np = nh >= 12 ? 'PM' : 'AM';
  const fh = nh > 12 ? nh - 12 : nh === 0 ? 12 : nh;
  return `${String(fh).padStart(2,'0')}:${String(nm).padStart(2,'0')} ${np}`;
}
function toISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${to24hr(timeStr)}:00+05:30`;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────
const spinnerSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;flex-shrink:0"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
const checkSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
const crossSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

// Add spin keyframes dynamically
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(spinStyle);

// ─── LOCATIONS PAGE — earliest slot per hospital ──────────────────────────
function renderEarliestSlotBanners() {
  LOCATIONS.forEach(loc => {
    const el = document.getElementById(`earliestSlot_${loc.id}`);
    if (!el) return;
    const earliest = findEarliestSlot(loc);
    if (earliest) {
      const dateLabel = new Date(earliest.dateStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      el.textContent = `Earliest available slot is at ${loc.name}, ${earliest.time}, ${dateLabel}.`;
    } else {
      el.textContent = '';
    }
  });
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  initBooking();
  fetchBlockedDates().then(renderEarliestSlotBanners);
  renderEarliestSlotBanners(); // render immediately too, refines once blocked dates load
});
