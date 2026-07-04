/**
 * DR. PUJA'S CLINIC — booking.js  v3
 *
 * ── CONFIGURATION ────────────────────────────────────────────────────────────
 *
 *  EMAILJS  (booking confirmation emails)
 *    1. https://emailjs.com → free account
 *    2. Add service (Gmail) → copy Service ID
 *    3. Create template    → copy Template ID
 *    4. Account → API Keys → copy Public Key
 *    Then: set enabled:true and paste the three keys below.
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
 *  CALENDLY  (alternative booking channel)
 *    1. https://calendly.com → create account + event type
 *    2. Copy your event URL (e.g. https://calendly.com/drpuja/consultation)
 *    Then: paste into BOOKING_CONFIG.calendly.url below.
 *
 *  WHATSAPP  — works immediately, no setup needed.
 */

'use strict';

// ── XSS SANITISER ─────────────────────────────────────────────────────────────
// Used on ALL user-controlled values before writing to innerHTML.
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

// ── CONFIG ────────────────────────────────────────────────────────────────────
const BOOKING_CONFIG = {

  emailjs: {
    publicKey:  'YOUR_EMAILJS_PUBLIC_KEY',   // ← paste
    serviceId:  'YOUR_EMAILJS_SERVICE_ID',    // ← paste
    templateId: 'YOUR_EMAILJS_TEMPLATE_ID',   // ← paste
    enabled: false,
  },

  googleCalendar: {
    clientId:   'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    calendarId: 'drpujasclinic@gmail.com',
    apiKey:     'YOUR_GOOGLE_API_KEY',
    enabled: false,
  },

  backend: {
    url:     'YOUR_APPS_SCRIPT_WEB_APP_URL', // ← paste after deployment
    enabled: false,
  },

  formspree: {
    endpoint: 'https://formspree.io/f/YOUR_FORM_ID', // ← paste
    enabled: false, // set true once endpoint is filled
  },

  calendly: {
    url: 'https://calendly.com/YOUR_CALENDLY_LINK', // ← paste
  },

  whatsapp: {
    patientPhone: '919899416040',
    doctorPhone:  '919899416040', // clinic's own number for doctor notifications
    enabled: true,
  },

  clinic: {
    name:  "Dr. Puja's Clinic",
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
    fee: '₹800',
    feeNum: 800,
    days: 'Mon–Sat 12–2 PM & 6–8:30 PM · Sunday 12–2 PM',
    openDays: [0, 1, 2, 3, 4, 5, 6],
    slots: {
      // Mon–Sat has both morning (noon) and evening sessions.
      // Sunday: noon session only — no evening.
      weekday: {
        morning: ['12:00 PM','12:15 PM','12:30 PM','12:45 PM',
                  '01:00 PM','01:15 PM','01:30 PM','01:45 PM'],
        evening: ['06:00 PM','06:15 PM','06:30 PM','06:45 PM',
                  '07:00 PM','07:15 PM','07:30 PM','07:45 PM',
                  '08:00 PM','08:15 PM'],
      },
      sunday: {
        morning: ['12:00 PM','12:15 PM','12:30 PM','12:45 PM',
                  '01:00 PM','01:15 PM','01:30 PM','01:45 PM'],
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
    days: 'Wed & Sat · 10 AM–12 PM',
    openDays: [3, 6], // Wed, Sat
    slots: {
      morning: ['10:00 AM','10:15 AM','10:30 AM','10:45 AM',
                '11:00 AM','11:15 AM','11:30 AM','11:45 AM'],
      evening: [],
    },
  },
  {
    id: 'max',
    name: 'Max Super Speciality Hospital',
    address: '108A, Indraprastha Extension, Patparganj',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Tue 2–4 PM · Sun 9–11 AM',
    openDays: [0, 2], // Sun, Tue
    slots: {
      morning: ['09:00 AM','09:15 AM','09:30 AM','09:45 AM',
                '10:00 AM','10:15 AM','10:30 AM','10:45 AM'],
      evening: ['02:00 PM','02:15 PM','02:30 PM','02:45 PM',
                '03:00 PM','03:15 PM','03:30 PM','03:45 PM'],
    },
  },
  {
    id: 'femmenest',
    name: 'Femmenest',
    address: 'Karkardooma, Delhi',
    fee: '₹1,000',
    feeNum: 1000,
    days: 'Mon & Thu · 9–11 AM',
    openDays: [1, 4], // Mon, Thu
    slots: {
      morning: ['09:00 AM','09:15 AM','09:30 AM','09:45 AM',
                '10:00 AM','10:15 AM','10:30 AM','10:45 AM'],
      evening: [],
    },
  },
];

// ── BOOKING STATE ─────────────────────────────────────────────────────────────
let bookingState = {
  type:      null,   // 'clinic' | 'video'
  location:  null,   // LOCATIONS entry
  date:      null,   // 'YYYY-MM-DD'
  time:      null,   // '12:00 PM'
  name:      '',
  phone:     '',
  email:     '',
  reason:    '',
  step:      1,
  isLoading: false,
};

// ── INIT ──────────────────────────────────────────────────────────────────────
function initBooking() {
  if (BOOKING_CONFIG.emailjs.enabled) {
    // emailjs is loaded via <script> in index.html
    emailjs.init(BOOKING_CONFIG.emailjs.publicKey);
  }
}

// ── OPEN / CLOSE MODAL ────────────────────────────────────────────────────────
function openBooking(locationId) {
  const overlay = document.getElementById('bookingOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Return focus to modal on close
  overlay._opener = document.activeElement;

  resetBookingState();

  if (locationId) {
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (loc) {
      // Came from Locations page — pre-fill location, skip to date/time
      bookingState.type     = 'clinic';
      bookingState.location = loc;
      renderStep(3);
      return;
    }
  }
  renderStep(1);
}

function closeBooking() {
  const overlay = document.getElementById('bookingOverlay');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  // Restore focus to whatever opened the modal
  if (overlay._opener && overlay._opener.focus) overlay._opener.focus();
}

function resetBookingState() {
  bookingState = {
    type: null, location: null, date: null, time: null,
    name: '', phone: '', email: '', reason: '',
    step: 1, isLoading: false,
  };
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  const label = document.getElementById('step1NextLabel');
  if (label) label.textContent = 'Next: Choose Location →';
  const banner = document.getElementById('earliestSlotBanner');
  if (banner) banner.style.display = 'none';
}

// ── STEP ROUTER ───────────────────────────────────────────────────────────────
function renderStep(step) {
  bookingState.step = step;
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('bookStep' + step);
  if (el) el.classList.add('active');
  updateStepIndicator(step);

  if (step === 1) renderAvailabilityBar();
  if (step === 2 && bookingState.type === 'clinic') renderLocationStep();
  if (step === 3) renderDateTimeStep();
  if (step === 4) renderSummaryStep();
}

function updateStepIndicator(activeStep) {
  for (let i = 1; i <= 4; i++) {
    const dot  = document.getElementById('stepDot'  + i);
    const line = document.getElementById('stepLine' + i);
    if (!dot) continue;
    dot.className = 'step-dot';
    if (i < activeStep)      { dot.classList.add('done');   dot.textContent = ''; }
    else if (i === activeStep){ dot.classList.add('active'); dot.textContent = i; }
    else                      { dot.textContent = i; }
    if (line) line.className = 'step-line' + (i < activeStep ? ' done' : '');
  }
}

// ── STICKY AVAILABILITY BAR (shown above Step 1) ──────────────────────────────
function renderAvailabilityBar() {
  const bar = document.getElementById('modalAvailabilityBar');
  if (!bar) return;
  // Build one-liner per location showing earliest available slot
  const lines = LOCATIONS.map(loc => {
    const earliest = findEarliestSlot(loc);
    if (!earliest) return null;
    const d = new Date(earliest.dateStr + 'T12:00:00');
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<span class="avail-item"><strong>${loc.name.split(',')[0]}</strong>: ${earliest.time}, ${dayLabel}</span>`;
  }).filter(Boolean);

  if (lines.length === 0) { bar.style.display = 'none'; return; }
  bar.innerHTML = '<span class="avail-label">Next available:</span> ' + lines.join('<span class="avail-sep">·</span>');
  bar.style.display = 'flex';
}

// ── STEP 1: TYPE ──────────────────────────────────────────────────────────────
function selectConsultationType(type) {
  bookingState.type = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('typeCard_' + type).classList.add('selected');
  const btn = document.getElementById('step1Next');
  btn.classList.remove('btn-disabled');
  btn.removeAttribute('disabled');
  document.getElementById('step1NextLabel').textContent =
    type === 'video' ? 'Next: Choose Date & Time →' : 'Next: Choose Location →';
}

function goStep1Next() {
  if (!bookingState.type) return;
  renderStep(bookingState.type === 'video' ? 3 : 2);
}

// ── STEP 2: LOCATION ──────────────────────────────────────────────────────────
function renderLocationStep() {
  const container = document.getElementById('locationOptionsList');
  container.innerHTML = LOCATIONS.map(loc => {
    const earliest = findEarliestSlot(loc);
    const earliestText = earliest
      ? (() => {
          const d = new Date(earliest.dateStr + 'T12:00:00');
          const dl = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          return `<div class="location-option-earliest">Next: ${earliest.time}, ${dl}</div>`;
        })()
      : '<div class="location-option-earliest location-option-full">No slots in next 14 days</div>';

    return `<div class="location-option ${bookingState.location?.id === loc.id ? 'selected' : ''}"
         onclick="selectLocation('${escapeHTML(loc.id)}')">
      <div>
        <div class="location-option-name">${escapeHTML(loc.name)}</div>
        <div class="location-option-detail">${escapeHTML(loc.days)}</div>
        ${earliestText}
      </div>
      <div class="location-option-fee">${escapeHTML(loc.fee)}</div>
    </div>`;
  }).join('');
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

// ── STEP 3: DATE & TIME ───────────────────────────────────────────────────────
function renderDateTimeStep() {
  const titleEl  = document.getElementById('step3Title');
  const labelEl  = document.getElementById('step3LocationLabel');
  const bannerEl = document.getElementById('earliestSlotBanner');

  if (bookingState.type === 'video') {
    if (titleEl)  titleEl.textContent = 'Choose a Date & Time';
    if (labelEl)  labelEl.textContent = 'Video Consultation — slots from Madhu Vihar timings';
    // Auto-select earliest available slot for video
    if (!bookingState.date) {
      const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
      const earliest   = findEarliestSlot(madhuVihar);
      if (earliest) {
        bookingState.date = earliest.dateStr;
        bookingState.time = earliest.time;
        if (bannerEl) {
          const dl = new Date(earliest.dateStr + 'T12:00:00')
            .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
          bannerEl.textContent = `Earliest available slot is ${earliest.time} on ${dl}.`;
          bannerEl.style.display = 'block';
        }
      }
    }
  } else {
    if (titleEl)  titleEl.textContent = 'Choose Date & Time';
    if (labelEl)  labelEl.textContent = bookingState.location?.name || '';
    if (bannerEl) bannerEl.style.display = 'none';
  }

  buildCalendar();

  if (BOOKING_CONFIG.googleCalendar.enabled) {
    fetchBookedSlots();
  } else if (bookingState.date) {
    renderTimeSlots();
  }
  checkStep3();
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
function buildCalendar() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayHeaders  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const monthNames  = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const activeLoc  = bookingState.type === 'video' ? madhuVihar : bookingState.location;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <span style="font-size:14px;font-weight:600;color:var(--ink);">${monthNames[month]} ${year}</span>
  </div>
  <div class="calendar-grid">`;

  dayHeaders.forEach(d => { html += `<div class="cal-header">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month, d);
    const isPast  = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSelected = bookingState.date === dateStr;
    const isToday    = date.toDateString() === now.toDateString();

    const daySlots = activeLoc ? getSlotsForLocationOnDate(activeLoc, dateStr) : { morning: [], evening: [] };
    let allSlots   = [...(daySlots.morning || []), ...(daySlots.evening || [])];
    if (isToday) allSlots = allSlots.filter(t => !isSlotInPast(t));
    const isClosed = activeLoc && allSlots.length === 0;

    const isDisabled = isPast || isClosed;
    let cls = 'cal-day';
    if (isDisabled)      cls += ' disabled';
    else if (isSelected) cls += ' selected';
    else if (isToday)    cls += ' today';

    const click = isDisabled ? '' : `onclick="selectDate('${dateStr}')"`;
    const title = (isClosed && !isPast) ? ' title="Not available at this location on this date"' : '';
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

// ── TIME SLOTS ────────────────────────────────────────────────────────────────
function renderTimeSlots() {
  const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const loc        = bookingState.type === 'video' ? madhuVihar : bookingState.location;
  const daySlots   = getSlotsForLocationOnDate(loc, bookingState.date);
  let   allSlots   = [...(daySlots.morning || []), ...(daySlots.evening || [])];

  const isToday = bookingState.date === todayDateStr();
  if (isToday) allSlots = allSlots.filter(t => !isSlotInPast(t));

  const slotsEl = document.getElementById('slotsGrid');
  const container = document.getElementById('slotsContainer');

  if (allSlots.length === 0) {
    const msg = isToday
      ? 'No remaining slots today. Please choose another date.'
      : 'No slots available on this date. Please choose another date.';
    slotsEl.innerHTML = `<div style="grid-column:1/-1;font-size:13px;color:var(--ink-faint);text-align:center;padding:12px 0;">${msg}</div>`;
    container.style.display = 'block';
    checkStep3();
    return;
  }

  slotsEl.innerHTML = allSlots.map(s => {
    const isBooked   = isSlotBooked(bookingState.date, loc?.id, s);
    const isSelected = bookingState.time === s;
    let cls = 'time-slot';
    if (isBooked)        cls += ' booked';
    else if (isSelected) cls += ' selected';
    const click = isBooked ? '' : `onclick="selectSlot('${s}')"`;
    return `<div class="${cls}" ${click}>${s}</div>`;
  }).join('');
  container.style.display = 'block';
  checkStep3();
}

function selectSlot(time) {
  bookingState.time = time;
  renderTimeSlots();
}

function checkStep3() {
  const btn = document.getElementById('step3Next');
  if (!btn) return;
  const valid = bookingState.date && bookingState.time;
  if (valid) { btn.classList.remove('btn-disabled'); btn.removeAttribute('disabled'); }
  else       { btn.classList.add('btn-disabled');    btn.setAttribute('disabled', ''); }
}

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
      ? (loc.slots.sunday  || { morning: [], evening: [] })
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
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  try { localStorage.setItem(SLOT_LOCK_KEY, JSON.stringify(locked)); } catch {}
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
    const res  = await fetch(`${BOOKING_CONFIG.backend.url}?action=getBlockedDates`);
    const data = await res.json();
    if (Array.isArray(data.blockedDates)) BLOCKED_DATES = data.blockedDates;
  } catch {
    // Silently use the fallback BLOCKED_DATES array above
  }
}

// ── STEP 4: PATIENT DETAILS ───────────────────────────────────────────────────
function renderSummaryStep() {
  const nameEl  = document.getElementById('bName');
  const phoneEl = document.getElementById('bPhone');
  if (nameEl)  nameEl.value  = bookingState.name;
  if (phoneEl) phoneEl.value = bookingState.phone;
}

function validateDetails() {
  const name  = document.getElementById('bName').value.trim();
  const phone = document.getElementById('bPhone').value.trim();
  const email = document.getElementById('bEmail').value.trim();
  let valid = true;

  [{ id:'bName',  val:name,  msg:'Name is required'          },
   { id:'bPhone', val:phone, msg:'Phone number is required'  }].forEach(f => {
    const el  = document.getElementById(f.id);
    const err = document.getElementById(f.id + 'Error');
    if (!f.val) { el.classList.add('error'); if (err) err.textContent = f.msg; valid = false; }
    else        { el.classList.remove('error'); if (err) err.textContent = ''; }
  });

  if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
    document.getElementById('bPhone').classList.add('error');
    document.getElementById('bPhoneError').textContent = 'Enter a valid 10-digit Indian mobile number';
    valid = false;
  }

  if (valid) {
    bookingState.name   = name;
    bookingState.phone  = phone;
    bookingState.email  = email;
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
  const dateLabel = s.date
    ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN',
        { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : '—';

  const rows = [
    { label: 'Patient',  value: s.name },
    { label: 'Phone',    value: s.phone },
    s.email    ? { label: 'Email',    value: s.email }                                           : null,
    { label: 'Type',     value: s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit' },
    s.location ? { label: 'Location', value: s.location.name }                                  : null,
    s.date     ? { label: 'Date',     value: dateLabel }                                         : null,
    s.time     ? { label: 'Time',     value: s.time }                                            : null,
    { label: 'Fee',      value: s.type === 'video' ? '₹800' : (s.location?.fee || '₹800') },
  ].filter(Boolean);

  // escapeHTML applied to every user-supplied value — no XSS possible here
  document.getElementById('confirmSummaryRows').innerHTML = rows.map(r =>
    `<div class="summary-row">
      <span class="summary-label">${escapeHTML(r.label)}</span>
      <span class="summary-value">${escapeHTML(r.value)}</span>
    </div>`
  ).join('');
}

// ── CONFIRM & SUBMIT ──────────────────────────────────────────────────────────
async function confirmBooking() {
  const consent = document.getElementById('bookingConsent');
  if (!consent.checked) {
    showNotification('⚠️ Consent Required', 'Please accept the consent checkbox to continue.');
    return;
  }

  const btn = document.getElementById('confirmBtn');
  btn.disabled    = true;
  btn.textContent = 'Processing…';

  // Lock this slot locally so it can't be double-booked from this browser
  const lockLocId = bookingState.type === 'video' ? 'madhu-vihar' : bookingState.location?.id;
  lockSlot(bookingState.date, lockLocId, bookingState.time);

  // Save to backend (Google Sheets) if configured
  if (BOOKING_CONFIG.backend.enabled) {
    await saveBookingToBackend().catch(() => {}); // non-blocking — local lock already done
  }

  const integrations = document.getElementById('integrationStatus');
  integrations.innerHTML = '';

  const addStatus = (id, label, state) => {
    // id and label are static strings — no user data here, safe without escapeHTML
    integrations.innerHTML += `<div class="integration-row ${state}" id="intRow_${id}">
      ${state === 'sending' ? spinnerSVG() : state === 'sent' ? checkSVG() : crossSVG()}
      <span>${label}</span>
    </div>`;
  };
  const updateStatus = (id, state, label) => {
    const row = document.getElementById('intRow_' + id);
    if (row) {
      row.className = `integration-row ${state}`;
      row.innerHTML = `${state === 'sent' ? checkSVG() : crossSVG()} <span>${label}</span>`;
    }
  };

  const tasks = [];

  // 1. Email confirmation (patient)
  if (BOOKING_CONFIG.emailjs.enabled && bookingState.email) {
    addStatus('email', 'Sending confirmation email…', 'sending');
    tasks.push(
      sendEmailConfirmation()
        .then(() => updateStatus('email', 'sent',   'Confirmation email sent'))
        .catch(()  => updateStatus('email', 'failed', 'Email failed — we\'ll confirm via WhatsApp'))
    );
  }

  // 2. Google Calendar event
  if (BOOKING_CONFIG.googleCalendar.enabled && bookingState.date && bookingState.time) {
    addStatus('cal', "Adding to Dr. Puja's calendar…", 'sending');
    tasks.push(
      createCalendarEvent()
        .then(() => updateStatus('cal', 'sent',   'Calendar event created'))
        .catch(() => updateStatus('cal', 'failed', 'Calendar sync failed — clinic notified'))
    );
  }

  // 3. Patient WhatsApp
  if (BOOKING_CONFIG.whatsapp.enabled) {
    addStatus('wa-patient', 'Preparing patient WhatsApp…', 'sending');
    tasks.push(new Promise(resolve => {
      setTimeout(() => {
        updateStatus('wa-patient', 'sent', 'Patient WhatsApp confirmation ready');
        resolve();
      }, 400);
    }));
  }

  // 4. Doctor WhatsApp (opens 1.5s after patient's tab)
  if (BOOKING_CONFIG.whatsapp.enabled) {
    addStatus('wa-doctor', 'Preparing doctor notification…', 'sending');
    tasks.push(new Promise(resolve => {
      setTimeout(() => {
        updateStatus('wa-doctor', 'sent', 'Doctor notification ready');
        resolve();
      }, 600);
    }));
  }

  await Promise.allSettled(tasks);

  // Show success screen
  btn.disabled = false;
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('bookStepSuccess').classList.add('active');
  document.querySelectorAll('.step-dot').forEach(d  => { d.className = 'step-dot done'; d.textContent = ''; });
  document.querySelectorAll('.step-line').forEach(l  => l.classList.add('done'));

  // Build the success summary — escapeHTML on ALL user-supplied values
  const s = bookingState;
  const dateLabel = s.date
    ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN',
        { weekday:'long', day:'numeric', month:'long' })
    : 'Video (flexible)';

  document.getElementById('confirmSummaryFinal').innerHTML =
    `<strong>${escapeHTML(s.name)}</strong><br>
     ${escapeHTML(s.type === 'video' ? 'Video Consultation' : s.location?.name || '')}<br>
     ${escapeHTML(dateLabel)}${s.time ? ' · ' + escapeHTML(s.time) : ''}<br>
     Fee: ${escapeHTML(s.type === 'video' ? '₹800' : (s.location?.fee || '₹800'))}`;

  // Open patient WhatsApp after 1 second
  if (BOOKING_CONFIG.whatsapp.enabled) {
    setTimeout(() => {
      const msg = buildWhatsAppMessage('patient');
      window.open(
        `https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(msg)}`,
        '_blank', 'noopener,noreferrer'
      );
    }, 1000);

    // Open doctor WhatsApp notification 1.5 seconds after patient's
    setTimeout(() => {
      const doctorMsg = buildWhatsAppMessage('doctor');
      window.open(
        `https://wa.me/${BOOKING_CONFIG.whatsapp.doctorPhone}?text=${encodeURIComponent(doctorMsg)}`,
        '_blank', 'noopener,noreferrer'
      );
    }, 2500);
  }

  showNotification(
    'Booking Confirmed ✓',
    `Appointment confirmed for ${escapeHTML(bookingState.name)}. WhatsApp opening shortly…`
  );
}

// ── BACKEND SAVE (Google Sheets) ──────────────────────────────────────────────
async function saveBookingToBackend() {
  if (!BOOKING_CONFIG.backend.enabled) return;
  const s = bookingState;
  await fetch(BOOKING_CONFIG.backend.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:     s.name,
      phone:    s.phone,
      email:    s.email || '',
      type:     s.type,
      location: s.location?.name || 'Video Consultation',
      date:     s.date,
      time:     s.time,
      fee:      s.type === 'video' ? '₹800' : (s.location?.fee || '₹800'),
      reason:   s.reason || '',
    }),
  });
}

// ── WHATSAPP MESSAGE BUILDER ──────────────────────────────────────────────────
function buildWhatsAppMessage(recipient) {
  const s = bookingState;
  const dateLabel = s.date
    ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN',
        { weekday:'long', day:'numeric', month:'long' })
    : 'Video (flexible)';

  if (recipient === 'doctor') {
    return [
      `🔔 *New Appointment Request*`,
      ``,
      `👤 Patient: ${s.name}`,
      `📱 Phone:   ${s.phone}`,
      `📋 Type:    ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
      s.location ? `📍 Location: ${s.location.name}` : '',
      s.date     ? `📅 Date:     ${dateLabel}` : '',
      s.time     ? `⏰ Time:     ${s.time}` : '',
      `💰 Fee:     ${s.type === 'video' ? '₹800' : (s.location?.fee || '₹800')}`,
      s.reason   ? `💬 Reason:   ${s.reason}` : '',
      ``,
      `— Sent from drpujaprasad.in booking system`,
    ].filter(Boolean).join('\n');
  }

  // Patient message
  return [
    `Hi Dr. Puja%27s Clinic! 🙏`,
    `I%27d like to confirm my appointment:`,
    ``,
    `👤 Name:     ${s.name}`,
    `📱 Phone:    ${s.phone}`,
    `📋 Type:     ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
    s.location ? `📍 Location: ${s.location.name}` : '',
    s.date     ? `📅 Date:     ${dateLabel}` : '',
    s.time     ? `⏰ Time:     ${s.time}` : '',
    `💰 Fee:      ${s.type === 'video' ? '₹800' : (s.location?.fee || '₹800')}`,
    s.reason   ? `💬 Reason:   ${s.reason}` : '',
  ].filter(Boolean).join('\n');
}

// ── EMAIL (EmailJS) ───────────────────────────────────────────────────────────
async function sendEmailConfirmation() {
  if (!BOOKING_CONFIG.emailjs.enabled) return;
  const s = bookingState;
  const dateLabel = s.date
    ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-IN',
        { day:'numeric', month:'long', year:'numeric' })
    : 'Video call (flexible)';
  return emailjs.send(
    BOOKING_CONFIG.emailjs.serviceId,
    BOOKING_CONFIG.emailjs.templateId,
    {
      to_name:          s.name,
      to_email:         s.email,
      appointment_type: s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit',
      location:         s.location?.name || 'Video Call',
      date:             dateLabel,
      time:             s.time || 'To be confirmed',
      fee:              s.type === 'video' ? '₹800' : (s.location?.fee || '₹800'),
      clinic_phone:     BOOKING_CONFIG.clinic.phone,
      clinic_name:      BOOKING_CONFIG.clinic.name,
      reason:           s.reason || 'General consultation',
    }
  );
}

// ── GOOGLE CALENDAR ───────────────────────────────────────────────────────────
async function createCalendarEvent() {
  if (!BOOKING_CONFIG.googleCalendar.enabled) return;
  const s        = bookingState;
  const startISO = toISO(s.date, s.time);
  const endISO   = toISO(s.date, addMinutes(s.time, 15));
  const event = {
    summary: `Appointment – ${s.name} [${s.type === 'video' ? 'Video' : 'Clinic'}]`,
    description: [
      `Patient: ${s.name}`,
      `Phone:   ${s.phone}`,
      `Email:   ${s.email || 'N/A'}`,
      `Type:    ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
      `Location:${s.location?.name || 'Video Call'}`,
      `Fee:     ${s.type === 'video' ? '₹800' : s.location?.fee}`,
      s.reason ? `Reason:  ${s.reason}` : '',
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
  return gapi.client.calendar.events.insert({
    calendarId: BOOKING_CONFIG.googleCalendar.calendarId,
    resource: event,
  });
}

async function fetchBookedSlots() {
  if (!BOOKING_CONFIG.googleCalendar.enabled || !bookingState.date) return;
  const lockLocId = bookingState.type === 'video' ? 'madhu-vihar' : bookingState.location?.id;
  try {
    const response = await gapi.client.calendar.events.list({
      calendarId:   BOOKING_CONFIG.googleCalendar.calendarId,
      timeMin:      `${bookingState.date}T00:00:00+05:30`,
      timeMax:      `${bookingState.date}T23:59:59+05:30`,
      singleEvents: true,
      orderBy:      'startTime',
    });
    (response.result.items || []).forEach(e => {
      const dt   = new Date(e.start.dateTime);
      const time = dt.toLocaleTimeString('en-IN',
        { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      lockSlot(bookingState.date, lockLocId, time);
    });
  } catch { /* fall back to localStorage locks */ }
  renderTimeSlots();
}

// ── CONTACT FORM (Formspree + WhatsApp fallback) ──────────────────────────────
async function submitContactForm(e) {
  e.preventDefault();
  const consent = document.getElementById('contactConsent');
  if (!consent.checked) {
    alert('Please accept the consent checkbox before submitting.');
    return;
  }

  const name    = document.getElementById('cName').value.trim();
  const email   = document.getElementById('cEmail').value.trim();
  const phone   = document.getElementById('cPhone').value.trim();
  const subject = document.getElementById('cSubject').value;
  const message = document.getElementById('cMessage').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

  let sent = false;

  // Option A — Formspree (preferred, real email delivery)
  if (BOOKING_CONFIG.formspree.enabled) {
    try {
      const res = await fetch(BOOKING_CONFIG.formspree.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      if (res.ok) sent = true;
    } catch {}
  }

  // Option B — EmailJS (if configured, fires alongside Formspree)
  if (BOOKING_CONFIG.emailjs.enabled && email) {
    emailjs.send(
      BOOKING_CONFIG.emailjs.serviceId,
      BOOKING_CONFIG.emailjs.templateId,
      { to_name: "Dr. Puja's Clinic", to_email: BOOKING_CONFIG.clinic.email,
        from_name: name, from_email: email, phone, subject, message }
    ).catch(() => {});
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }

  if (sent) {
    // Real delivery confirmed — show success
    document.getElementById('contactForm').style.display  = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Message Sent ✓', "We'll get back to you within 24 hours.");
  } else {
    // Formspree not configured or failed — redirect to WhatsApp with the message pre-filled
    const waText = `Hi Dr. Puja%27s Clinic!\n\nMessage via website:\nName: ${name}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`;
    window.open(
      `https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(waText)}`,
      '_blank', 'noopener,noreferrer'
    );
    // Show success anyway — WhatsApp is now carrying the message
    document.getElementById('contactForm').style.display  = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
    showNotification('Redirected to WhatsApp', 'Your message has been pre-filled in WhatsApp. Please tap Send.');
  }
}

// ── NOTIFICATION TOAST ────────────────────────────────────────────────────────
function showNotification(title, msg) {
  const n = document.getElementById('notification');
  // Use textContent — never innerHTML — for notification content (user-supplied values)
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent   = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}

// ── TIME UTILITIES ────────────────────────────────────────────────────────────
function to24hr(timeStr) {
  if (!timeStr) return '12:00';
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function addMinutes(timeStr, mins) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  const np = nh >= 12 ? 'PM' : 'AM';
  const fh = nh > 12 ? nh - 12 : (nh === 0 ? 12 : nh);
  return `${String(fh).padStart(2,'0')}:${String(nm).padStart(2,'0')} ${np}`;
}

function toISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${to24hr(timeStr)}:00+05:30`;
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

// ── SVG HELPERS (static strings — no user data) ───────────────────────────────
const spinnerSVG = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
    style="animation:spin 1s linear infinite;flex-shrink:0">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
const checkSVG = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5">
    <polyline points="20 6 9 17 4 12"/></svg>`;
const crossSVG = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M18 6 6 18M6 6l12 12"/></svg>`;

// Inject spin keyframes once
(function injectSpinKeyframes() {
  const s = document.createElement('style');
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}());

// ── AUTO-INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBooking();
  fetchBlockedDates().then(renderEarliestSlotBanners);
  renderEarliestSlotBanners(); // immediate render, refines after blocked dates load
});
