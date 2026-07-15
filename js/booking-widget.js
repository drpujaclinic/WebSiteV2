/**
 * DR. PUJA'S CLINIC — Booking Widget v2
 * UI matches the provided screenshot:
 *   Tab (In-Person / Video) → Doctor card → Horizontal date strip →
 *   3-slot preview + "See all slots" → Phone number → OTP → Confirm → WhatsApp
 *
 * Presentation:
 *   Mobile  (≤768px): bottom sheet slides up from screen bottom
 *   Desktop (>768px): centred modal with backdrop
 *
 * Dependencies: booking.js must be loaded first (LOCATIONS, slot helpers,
 *   escapeHTML, isSlotBooked, lockSlot, findEarliestSlot, getSlotsForLocationOnDate,
 *   todayDateStr, isSlotInPast, formatDateStr, BOOKING_CONFIG)
 */

'use strict';

// ── WIDGET STATE ──────────────────────────────────────────────────────────────
const widgetState = {
  screen:       'booking',   // 'booking' | 'phone' | 'otp' | 'details' | 'confirm' | 'success'
  type:         'clinic',    // 'clinic' | 'video'
  location:     null,        // LOCATIONS entry
  date:         null,        // 'YYYY-MM-DD'
  time:         null,        // '12:00 PM'
  slotsExpanded: false,
  phone:        '',
  otp:          '',
  otpTimer:     null,
  otpSeconds:   30,
  name:         '',
  email:        '',
  reason:       '',
  // restore previously opened location (from Locations page)
  presetLocId:  null,
};

// ── OPEN / CLOSE ──────────────────────────────────────────────────────────────
function openBooking(locationId) {
  const overlay = document.getElementById('bwOverlay');
  if (!overlay) return;

  // Reset state
  Object.assign(widgetState, {
    screen: 'booking', type: 'clinic', date: null, time: null,
    slotsExpanded: false, phone: '', otp: '', name: '', email: '', reason: '',
    presetLocId: locationId || null,
  });
  clearInterval(widgetState.otpTimer);

  // Pre-select location if provided (from Locations page)
  if (locationId) {
    widgetState.location = LOCATIONS.find(l => l.id === locationId) || LOCATIONS[0];
  } else {
    widgetState.location = LOCATIONS[0]; // default: Madhu Vihar
  }

  // Auto-select today if it's an open day, else next open day
  widgetState.date = pickDefaultDate(widgetState.location);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  overlay._opener = document.activeElement;

  renderWidget();
  // Animate bottom sheet in on mobile
  requestAnimationFrame(() => {
    const sheet = document.getElementById('bwSheet');
    if (sheet) sheet.classList.add('in');
  });
}

function closeBooking() {
  const overlay = document.getElementById('bwOverlay');
  const sheet   = document.getElementById('bwSheet');
  clearInterval(widgetState.otpTimer);
  if (sheet) {
    sheet.classList.remove('in');
    setTimeout(() => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }, 300);
  } else {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (overlay._opener && overlay._opener.focus) overlay._opener.focus();
}

function closeBookingOutside(e) {
  if (e.target === document.getElementById('bwOverlay')) closeBooking();
}

// ── DATE HELPERS ──────────────────────────────────────────────────────────────
function pickDefaultDate(loc) {
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ds = formatDateStr(d);
    const slots = getSlotsForLocationOnDate(loc, ds);
    const all = [...(slots.morning || []), ...(slots.evening || [])];
    const available = i === 0 ? all.filter(t => !isSlotInPast(t)) : all;
    if (available.length > 0) return ds;
  }
  return formatDateStr(new Date());
}

function buildDateStrip(loc) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const today = new Date();
  const items = [];

  // Month label (first pill — non-selectable)
  items.push(`<div class="bw-date-month" aria-hidden="true">${months[today.getMonth()]}</div>`);

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = formatDateStr(d);
    const daySlots = getSlotsForLocationOnDate(loc, ds);
    const allSlots = [...(daySlots.morning || []), ...(daySlots.evening || [])];
    const available = i === 0
      ? allSlots.filter(t => !isSlotBooked(ds, loc.id, t) && !isSlotInPast(t))
      : allSlots.filter(t => !isSlotBooked(ds, loc.id, t));
    const total = i === 0
      ? allSlots.filter(t => !isSlotInPast(t)).length
      : allSlots.length;

    const isSelected = widgetState.date === ds;
    const isClosed   = total === 0;
    const isFull     = total > 0 && available.length === 0;
    const isAlmost   = available.length > 0 && available.length <= 3;

    let label = '';
    let indicatorClass = '';
    if (isClosed)      { label = 'Closed';    indicatorClass = 'bw-ind-closed'; }
    else if (isFull)   { label = 'Full';       indicatorClass = 'bw-ind-full'; }
    else if (isAlmost) { label = `${available.length} left`; indicatorClass = 'bw-ind-few'; }
    else               { label = 'Available';  indicatorClass = 'bw-ind-open'; }

    const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tom' : String(d.getDate());
    const disabled = isClosed || isFull;

    items.push(`
      <button class="bw-date-pill ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
              ${disabled ? 'disabled aria-disabled="true"' : `onclick="bwSelectDate('${ds}')"`}
              aria-label="${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${label}"
              aria-pressed="${isSelected}">
        <span class="bw-date-label">${dayLabel}</span>
        <span class="bw-date-day">${days[d.getDay()]}</span>
        <span class="bw-indicator ${indicatorClass}" aria-hidden="true"></span>
      </button>`);
  }
  return items.join('');
}

function buildSlots(loc, date, expanded) {
  const daySlots = getSlotsForLocationOnDate(loc, date);
  const morning  = (daySlots.morning || []).filter(t => date === todayDateStr() ? !isSlotInPast(t) : true);
  const evening  = (daySlots.evening || []).filter(t => date === todayDateStr() ? !isSlotInPast(t) : true);

  // For video, treat as one pool
  const madhu = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const effectiveLoc = widgetState.type === 'video' ? madhu : loc;
  const effectiveDay = getSlotsForLocationOnDate(effectiveLoc, date);
  const eMorning = (effectiveDay.morning || []).filter(t => date === todayDateStr() ? !isSlotInPast(t) : true);
  const eEvening = (effectiveDay.evening || []).filter(t => date === todayDateStr() ? !isSlotInPast(t) : true);
  const all = [...eMorning, ...eEvening];

  if (all.length === 0) {
    return `<div class="bw-no-slots">No slots available on this date. Please choose another date.</div>`;
  }

  if (!expanded) {
    // Show first 3 available slots as preview
    const preview = all.filter(t => !isSlotBooked(date, effectiveLoc.id, t)).slice(0, 3);
    if (preview.length === 0) {
      return `<div class="bw-no-slots">All slots booked for this date.</div>`;
    }
    const pills = preview.map(t => slotPill(t, date, effectiveLoc.id)).join('');
    const remaining = all.filter(t => !isSlotBooked(date, effectiveLoc.id, t)).length - preview.length;
    const seeAll = `<button class="bw-see-all" onclick="bwExpandSlots()" aria-expanded="false">
      See all slots <span aria-hidden="true">›</span>
    </button>`;
    return `<div class="bw-slots-preview">${pills}</div>${seeAll}`;
  }

  // Expanded: Morning / Evening groups
  const groups = [];
  if (eMorning.length > 0) {
    groups.push(`<div class="bw-slot-group">
      <div class="bw-slot-group-label">Morning</div>
      <div class="bw-slots-grid">${eMorning.map(t => slotPill(t, date, effectiveLoc.id)).join('')}</div>
    </div>`);
  }
  if (eEvening.length > 0) {
    groups.push(`<div class="bw-slot-group">
      <div class="bw-slot-group-label">Evening</div>
      <div class="bw-slots-grid">${eEvening.map(t => slotPill(t, date, effectiveLoc.id)).join('')}</div>
    </div>`);
  }
  return `<div class="bw-slots-expanded">${groups.join('')}</div>`;
}

function slotPill(time, date, locId) {
  const booked   = isSlotBooked(date, locId, time);
  const selected = widgetState.time === time;
  let cls = 'bw-slot';
  if (booked)        cls += ' booked';
  else if (selected) cls += ' selected';
  const click = booked ? '' : `onclick="bwSelectSlot('${time}')"`;
  const label = booked ? `${time} — booked` : time;
  return `<button class="${cls}" ${click} ${booked ? 'disabled aria-disabled="true"' : ''}
    aria-label="${label}" aria-pressed="${selected}">${time}</button>`;
}

// ── SCREEN RENDERERS ───────────────────────────────────────────────────────────

function renderWidget() {
  const body = document.getElementById('bwBody');
  if (!body) return;
  switch (widgetState.screen) {
    case 'booking': body.innerHTML = renderBookingScreen(); break;
    case 'phone':   body.innerHTML = renderPhoneScreen();   break;
    case 'otp':     body.innerHTML = renderOTPScreen();     break;
    case 'details': body.innerHTML = renderDetailsScreen(); break;
    case 'confirm': body.innerHTML = renderConfirmScreen(); break;
    case 'success': body.innerHTML = renderSuccessScreen(); break;
  }
  // After render, scroll date strip so the month label + earliest dates stay visible
  if (widgetState.screen === 'booking') {
    requestAnimationFrame(() => {
      const sel = document.querySelector('.bw-date-pill.selected');
      // 'nearest' avoids re-centring, which was pushing the month pill off-screen
      // whenever "Today" (near the very start of the strip) was selected.
      if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  }
  // Auto-focus first input on phone/otp screens
  if (widgetState.screen === 'phone') {
    requestAnimationFrame(() => document.getElementById('bwPhone')?.focus());
  }
  if (widgetState.screen === 'otp') {
    requestAnimationFrame(() => document.getElementById('bwOTP')?.focus());
    startOTPTimer();
  }
}

function renderBookingScreen() {
  const loc  = widgetState.location;
  const date = widgetState.date;
  const isVideo = widgetState.type === 'video';
  const fee  = isVideo ? '₹800' : (loc?.fee || '₹800');
  const title = isVideo ? 'Book Video Consultation' : 'Book In-Person Appointment';

  // Video consults run on Madhu Vihar's own timings/branding regardless of
  // whichever clinic was last selected on the In-Person tab.
  const madhuVihar = LOCATIONS.find(l => l.id === 'madhu-vihar');
  const brandLoc = isVideo ? madhuVihar : loc;

  // Location selector (pill list)
  const locPills = LOCATIONS.map(l =>
    `<button class="bw-loc-pill ${widgetState.location?.id === l.id ? 'active' : ''}"
      onclick="bwSelectLocation('${l.id}')"
      aria-pressed="${widgetState.location?.id === l.id}">${l.name.split(',')[0].split(' ')[0]} ${l.name.split(',')[0].split(' ')[1] || ''}</button>`
  ).join('');

  return `
    <!-- Tab switcher -->
    <div class="bw-tabs" role="tablist" aria-label="Consultation type">
      <button class="bw-tab ${!isVideo ? 'active' : ''}" role="tab"
        aria-selected="${!isVideo}" onclick="bwSetType('clinic')">In-Person Appointment</button>
      <button class="bw-tab ${isVideo ? 'active' : ''}" role="tab"
        aria-selected="${isVideo}" onclick="bwSetType('video')">Video Consultation</button>
    </div>

    <!-- Doctor / location card — name, logo, and address update per selected location -->
    <div class="bw-doctor-card">
      <div class="bw-doctor-left">
        <div class="bw-clinic-logo" aria-hidden="true">
          <img src="${escapeHTML(brandLoc?.logo || 'images/logo.jpg')}" alt="" width="48" height="48"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="bw-logo-fallback" style="display:none">🏥</div>
        </div>
        <div class="bw-doctor-info">
          <div class="bw-doctor-name">${escapeHTML(brandLoc?.name || "Dr. Puja's Clinic")}</div>
          <div class="bw-doctor-sub">
            ${escapeHTML(brandLoc?.short || brandLoc?.address || 'Patparganj, Delhi')}
          </div>
          ${!isVideo ? `<button class="bw-more-locs" onclick="bwToggleLocations(event)">
            +${LOCATIONS.length - 1} More Locations <span aria-hidden="true">›</span>
          </button>` : ''}
        </div>
      </div>
    </div>

    <!-- Location selector (shown when +More clicked) -->
    <div id="bwLocSelector" class="bw-loc-selector" style="display:none" role="listbox" aria-label="Select location">
      ${locPills}
    </div>

    <!-- Booking header with fee -->
    <div class="bw-booking-header">
      <span class="bw-booking-title">${title}</span>
      <span class="bw-booking-fee">${escapeHTML(fee)}</span>
    </div>

    <!-- Horizontal date strip -->
    <div class="bw-date-strip" role="group" aria-label="Select appointment date">
      <div class="bw-date-scroll" id="bwDateScroll">
        ${buildDateStrip(isVideo ? LOCATIONS[0] : loc)}
      </div>
    </div>

    <!-- Time slots -->
    <div class="bw-slots-section" id="bwSlotsSection" aria-live="polite">
      ${date ? buildSlots(isVideo ? LOCATIONS[0] : loc, date, widgetState.slotsExpanded) : '<div class="bw-no-slots">Select a date above</div>'}
    </div>
  `;
}

function renderPhoneScreen() {
  return `
    <div class="bw-back-row">
      <button class="bw-back-btn" onclick="bwGoBack()" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title">Confirm with phone number</span>
    </div>

    <!-- Appointment mini-summary -->
    <div class="bw-mini-summary">
      <div class="bw-mini-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>${formatDateForDisplay(widgetState.date)}</span>
      </div>
      <div class="bw-mini-sep" aria-hidden="true">·</div>
      <div class="bw-mini-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${escapeHTML(widgetState.time)}</span>
      </div>
      <div class="bw-mini-sep" aria-hidden="true">·</div>
      <div class="bw-mini-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${escapeHTML(widgetState.type === 'video' ? 'Video' : widgetState.location?.name?.split(',')[0] || 'Clinic')}</span>
      </div>
    </div>

    <div class="bw-phone-wrap">
      <p class="bw-phone-label">Enter your mobile number to receive an OTP</p>
      <div class="bw-phone-input-row">
        <div class="bw-country-code" aria-label="India +91">
          <span class="bw-flag">🇮🇳</span><span>+91</span>
        </div>
        <input type="tel" id="bwPhone" class="bw-phone-input"
               placeholder="10-digit mobile number"
               maxlength="10" inputmode="numeric" pattern="[6-9][0-9]{9}"
               autocomplete="tel-national"
               onkeydown="if(event.key==='Enter')bwSendOTP()"
               oninput="bwPhoneInput(this)"
               aria-label="Mobile number" aria-required="true">
      </div>
      <div class="bw-phone-error" id="bwPhoneError" role="alert" aria-live="polite"></div>
    </div>

    <button class="bw-primary-btn" id="bwSendOTPBtn" onclick="bwSendOTP()" disabled>
      Send OTP
    </button>

    <p class="bw-privacy-note">
      Your number is used only for appointment confirmation.
      <a href="#privacy" onclick="showPage('privacy');closeBooking();return false;" style="color:inherit;text-decoration:underline">Privacy Policy</a>
    </p>
  `;
}

function renderOTPScreen() {
  return `
    <div class="bw-back-row">
      <button class="bw-back-btn" onclick="bwGoScreen('phone')" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title">Enter OTP</span>
    </div>

    <div class="bw-otp-wrap">
      <p class="bw-otp-label">
        OTP sent to <strong>+91 ${escapeHTML(widgetState.phone)}</strong>
      </p>

      <div class="bw-otp-input-group" role="group" aria-label="6-digit OTP">
        ${[0,1,2,3,4,5].map(i =>
          `<input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]"
            class="bw-otp-box" id="bwOTPBox${i}"
            autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
            aria-label="OTP digit ${i+1}"
            onkeydown="bwOTPKey(event,${i})"
            oninput="bwOTPInput(event,${i})"
            onpaste="bwOTPPaste(event)">`
        ).join('')}
      </div>

      <div class="bw-otp-error" id="bwOTPError" role="alert" aria-live="polite"></div>

      <div class="bw-otp-timer" id="bwOTPTimer" aria-live="polite">
        Resend OTP in <strong id="bwTimerVal">0:30</strong>
      </div>
      <button class="bw-resend-btn" id="bwResendBtn" onclick="bwResendOTP()" disabled>
        Resend OTP
      </button>
    </div>

    <button class="bw-primary-btn" id="bwVerifyBtn" onclick="bwVerifyOTP()" disabled>
      Verify &amp; Continue
    </button>
  `;
}

function renderDetailsScreen() {
  const reasons = ['Pregnancy','Infertility','PCOS','Routine Check-up','Menstrual Issues','Menopause','Ultrasound Review','Vaccination','Other'];
  return `
    <div class="bw-back-row">
      <button class="bw-back-btn" onclick="bwGoScreen('phone')" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title">Your Details</span>
    </div>

    <div class="bw-form-group">
      <label class="bw-form-label" for="bwName">Full Name *</label>
      <input type="text" id="bwName" class="bw-form-input"
             placeholder="Patient's full name" autocomplete="name"
             value="${escapeHTML(widgetState.name)}"
             oninput="widgetState.name=this.value;bwCheckDetails()">
    </div>
    <div class="bw-form-group">
      <label class="bw-form-label" for="bwEmail">Email <span class="bw-optional">(for confirmation)</span></label>
      <input type="email" id="bwEmail" class="bw-form-input"
             placeholder="your@email.com" autocomplete="email"
             value="${escapeHTML(widgetState.email)}"
             oninput="widgetState.email=this.value">
    </div>

    <div class="bw-form-group">
      <label class="bw-form-label">Reason for Visit <span class="bw-optional">(optional)</span></label>
      <div class="bw-reason-chips" role="group" aria-label="Reason for visit">
        ${reasons.map(r => `<button class="bw-chip ${widgetState.reason === r ? 'selected' : ''}"
          onclick="bwSelectReason('${r}')" aria-pressed="${widgetState.reason === r}">${r}</button>`).join('')}
      </div>
    </div>

    <button class="bw-primary-btn" id="bwDetailsBtn" onclick="bwGoScreen('confirm')" disabled>
      Review Appointment
    </button>
  `;
}

function renderConfirmScreen() {
  const fee = widgetState.type === 'video' ? '₹800' : (widgetState.location?.fee || '₹800');
  return `
    <div class="bw-back-row">
      <button class="bw-back-btn" onclick="bwGoScreen('details')" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title">Confirm Appointment</span>
    </div>

    <div class="bw-summary-card">
      <div class="bw-summary-row"><span class="bw-summary-label">Patient</span><span class="bw-summary-val">${escapeHTML(widgetState.name)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Mobile</span><span class="bw-summary-val">+91 ${escapeHTML(widgetState.phone)}</span></div>
      ${widgetState.email ? `<div class="bw-summary-row"><span class="bw-summary-label">Email</span><span class="bw-summary-val">${escapeHTML(widgetState.email)}</span></div>` : ''}
      <div class="bw-summary-row"><span class="bw-summary-label">Type</span><span class="bw-summary-val">${widgetState.type === 'video' ? 'Video Consultation' : 'In-Person Visit'}</span></div>
      ${widgetState.type === 'clinic' ? `<div class="bw-summary-row"><span class="bw-summary-label">Location</span><span class="bw-summary-val">${escapeHTML(widgetState.location?.name || '')}</span></div>` : ''}
      <div class="bw-summary-row"><span class="bw-summary-label">Date</span><span class="bw-summary-val">${formatDateForDisplay(widgetState.date)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Time</span><span class="bw-summary-val">${escapeHTML(widgetState.time)}</span></div>
      <div class="bw-summary-row bw-summary-fee"><span class="bw-summary-label">Fee</span><span class="bw-summary-val bw-fee-highlight">${escapeHTML(fee)}</span></div>
      ${widgetState.reason ? `<div class="bw-summary-row"><span class="bw-summary-label">Reason</span><span class="bw-summary-val">${escapeHTML(widgetState.reason)}</span></div>` : ''}
    </div>

    <div class="bw-policy-box">
      <p>Cancellation: Please inform us at least 2 hours before your appointment.</p>
    </div>

    <div class="bw-consent-row">
      <input type="checkbox" id="bwConsent" onchange="bwCheckConsent()">
      <label for="bwConsent">I confirm the information is correct and consent to Dr. Puja's Clinic contacting me for this appointment.</label>
    </div>

    <button class="bw-primary-btn bw-confirm-btn" id="bwFinalConfirmBtn" onclick="bwConfirm()" disabled>
      Confirm Appointment
    </button>
  `;
}

function renderSuccessScreen() {
  const fee = widgetState.type === 'video' ? '₹800' : (widgetState.location?.fee || '₹800');
  const dl = formatDateForDisplay(widgetState.date);
  return `
    <div class="bw-success-wrap" role="alert" aria-live="assertive">
      <div class="bw-success-tick" aria-hidden="true">✅</div>
      <h3 class="bw-success-title">Appointment Confirmed!</h3>
      <p class="bw-success-sub">
        Your WhatsApp confirmation is opening. Please tap Send to complete.
      </p>

      <div class="bw-success-details">
        <div class="bw-sum-row"><span>${escapeHTML(widgetState.name)}</span></div>
        <div class="bw-sum-row">
          <span>${dl}</span>
          <span class="bw-dot" aria-hidden="true">·</span>
          <span>${escapeHTML(widgetState.time)}</span>
        </div>
        <div class="bw-sum-row">
          <span>${widgetState.type === 'video' ? 'Video Consultation' : escapeHTML(widgetState.location?.name || '')}</span>
          <span class="bw-dot" aria-hidden="true">·</span>
          <span class="bw-success-fee">${escapeHTML(fee)}</span>
        </div>
      </div>

      <div class="bw-success-actions">
        <a href="https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(buildSuccessWAMessage())}"
           target="_blank" rel="noopener noreferrer"
           class="bw-wa-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          WhatsApp Confirmation
        </a>
        <button class="bw-done-btn" onclick="closeBooking()">Done</button>
      </div>
    </div>
  `;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function bwSetType(type) {
  widgetState.type = type;
  widgetState.slotsExpanded = false;
  widgetState.time = null;
  widgetState.date = pickDefaultDate(
    type === 'video' ? LOCATIONS[0] : widgetState.location
  );
  renderWidget();
}

function bwSelectLocation(locId) {
  widgetState.location = LOCATIONS.find(l => l.id === locId);
  widgetState.date = pickDefaultDate(widgetState.location);
  widgetState.time = null;
  widgetState.slotsExpanded = false;
  const sel = document.getElementById('bwLocSelector');
  if (sel) sel.style.display = 'none';
  renderWidget();
}

function bwToggleLocations(e) {
  e.stopPropagation();
  const sel = document.getElementById('bwLocSelector');
  if (sel) sel.style.display = sel.style.display === 'none' ? 'flex' : 'none';
}

function bwSelectDate(ds) {
  widgetState.date = ds;
  widgetState.time = null;
  widgetState.slotsExpanded = false;
  // Re-render just the date strip and slots section
  const strip = document.getElementById('bwDateScroll');
  const slots = document.getElementById('bwSlotsSection');
  const loc   = widgetState.type === 'video' ? LOCATIONS[0] : widgetState.location;
  if (strip) strip.innerHTML = buildDateStrip(loc);
  if (slots) {
    slots.innerHTML = buildSlots(loc, ds, false);
    slots.setAttribute('aria-live', 'polite');
  }
  // Scroll selected pill into view — 'nearest' keeps the month label visible
  // when an early date (e.g. Today) is picked, only scrolling when truly needed.
  requestAnimationFrame(() => {
    const sel = document.querySelector('.bw-date-pill.selected');
    if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  });
}

function bwExpandSlots() {
  widgetState.slotsExpanded = true;
  const slots = document.getElementById('bwSlotsSection');
  const loc   = widgetState.type === 'video' ? LOCATIONS[0] : widgetState.location;
  if (slots) slots.innerHTML = buildSlots(loc, widgetState.date, true);
}

function bwSelectSlot(time) {
  widgetState.time = time;
  // If slot selected on expanded view, keep expanded; otherwise collapsed
  const slots = document.getElementById('bwSlotsSection');
  const loc   = widgetState.type === 'video' ? LOCATIONS[0] : widgetState.location;
  if (slots) slots.innerHTML = buildSlots(loc, widgetState.date, widgetState.slotsExpanded);
  // Proceed to phone after brief visual tick
  setTimeout(() => bwGoScreen('phone'), 350);
}

function bwGoBack() {
  widgetState.screen = 'booking';
  renderWidget();
}

function bwGoScreen(screen) {
  // Validate before moving forward
  if (screen === 'confirm') {
    widgetState.name = document.getElementById('bwName')?.value.trim() || '';
    widgetState.email = document.getElementById('bwEmail')?.value.trim() || '';
    if (!widgetState.name) {
      document.getElementById('bwName')?.classList.add('error');
      return;
    }
  }
  widgetState.screen = screen;
  renderWidget();
}

// ── PHONE INPUT ───────────────────────────────────────────────────────────────
function bwPhoneInput(el) {
  el.value = el.value.replace(/\D/g, '').slice(0, 10);
  widgetState.phone = el.value;
  const btn = document.getElementById('bwSendOTPBtn');
  const valid = /^[6-9]\d{9}$/.test(el.value);
  if (btn) btn.disabled = !valid;
  const err = document.getElementById('bwPhoneError');
  if (err) err.textContent = '';
}

function bwSendOTP() {
  const phone = widgetState.phone;
  if (!/^[6-9]\d{9}$/.test(phone)) {
    const err = document.getElementById('bwPhoneError');
    if (err) err.textContent = 'Enter a valid 10-digit Indian mobile number';
    return;
  }
  // When MSG91 is configured: call /api/auth/otp/send
  // For now: simulate OTP sent (demo mode)
  widgetState.screen = 'otp';
  widgetState.otp = '';
  widgetState.otpSeconds = 30;
  renderWidget();
}

// ── OTP INPUT ─────────────────────────────────────────────────────────────────
function bwOTPInput(e, idx) {
  const val = e.target.value.replace(/\D/g, '');
  e.target.value = val;
  if (val && idx < 5) {
    document.getElementById(`bwOTPBox${idx + 1}`)?.focus();
  }
  bwCollectOTP();
}

function bwOTPKey(e, idx) {
  if (e.key === 'Backspace' && !e.target.value && idx > 0) {
    document.getElementById(`bwOTPBox${idx - 1}`)?.focus();
  }
  if (e.key === 'ArrowLeft' && idx > 0) {
    e.preventDefault();
    document.getElementById(`bwOTPBox${idx - 1}`)?.focus();
  }
  if (e.key === 'ArrowRight' && idx < 5) {
    e.preventDefault();
    document.getElementById(`bwOTPBox${idx + 1}`)?.focus();
  }
}

function bwOTPPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
  text.split('').forEach((ch, i) => {
    const box = document.getElementById(`bwOTPBox${i}`);
    if (box) box.value = ch;
  });
  document.getElementById(`bwOTPBox${Math.min(text.length, 5)}`)?.focus();
  bwCollectOTP();
}

function bwCollectOTP() {
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += document.getElementById(`bwOTPBox${i}`)?.value || '';
  }
  widgetState.otp = otp;
  const btn = document.getElementById('bwVerifyBtn');
  if (btn) btn.disabled = otp.length < 6;
  const err = document.getElementById('bwOTPError');
  if (err) err.textContent = '';
}

function startOTPTimer() {
  clearInterval(widgetState.otpTimer);
  widgetState.otpSeconds = 30;
  const resendBtn = document.getElementById('bwResendBtn');
  const timerEl   = document.getElementById('bwOTPTimer');
  const valEl     = document.getElementById('bwTimerVal');
  if (resendBtn) resendBtn.disabled = true;

  widgetState.otpTimer = setInterval(() => {
    widgetState.otpSeconds--;
    if (valEl) valEl.textContent = `0:${String(widgetState.otpSeconds).padStart(2, '0')}`;
    if (widgetState.otpSeconds <= 0) {
      clearInterval(widgetState.otpTimer);
      if (timerEl)   timerEl.style.display = 'none';
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

function bwResendOTP() {
  widgetState.otpSeconds = 30;
  // Reset boxes
  for (let i = 0; i < 6; i++) {
    const box = document.getElementById(`bwOTPBox${i}`);
    if (box) box.value = '';
  }
  widgetState.otp = '';
  const btn = document.getElementById('bwVerifyBtn');
  if (btn) btn.disabled = true;
  const timerEl = document.getElementById('bwOTPTimer');
  if (timerEl) timerEl.style.display = 'block';
  startOTPTimer();
}

function bwVerifyOTP() {
  const otp = widgetState.otp;
  if (otp.length < 6) return;

  // When MSG91 is configured: POST to /api/auth/otp/verify
  // Demo mode: accept any 6-digit OTP
  if (otp.length === 6) {
    clearInterval(widgetState.otpTimer);
    widgetState.screen = 'details';
    renderWidget();
    // Re-check details after render
    setTimeout(bwCheckDetails, 50);
  } else {
    const err = document.getElementById('bwOTPError');
    if (err) err.textContent = 'Incorrect OTP. Please try again.';
  }
}

// ── DETAILS ───────────────────────────────────────────────────────────────────
function bwSelectReason(r) {
  widgetState.reason = widgetState.reason === r ? '' : r;
  // Re-render just the chips
  const chips = document.querySelector('.bw-reason-chips');
  const reasons = ['Pregnancy','Infertility','PCOS','Routine Check-up','Menstrual Issues','Menopause','Ultrasound Review','Vaccination','Other'];
  if (chips) chips.innerHTML = reasons.map(re =>
    `<button class="bw-chip ${widgetState.reason === re ? 'selected' : ''}"
      onclick="bwSelectReason('${re}')" aria-pressed="${widgetState.reason === re}">${re}</button>`
  ).join('');
}

function bwCheckDetails() {
  const name = document.getElementById('bwName')?.value.trim() || '';
  widgetState.name = name;
  const btn = document.getElementById('bwDetailsBtn');
  if (btn) btn.disabled = !name;
}

// ── CONFIRM ───────────────────────────────────────────────────────────────────
function bwCheckConsent() {
  const btn = document.getElementById('bwFinalConfirmBtn');
  const cb  = document.getElementById('bwConsent');
  if (btn) btn.disabled = !cb?.checked;
}

function bwConfirm() {
  const locId = widgetState.type === 'video' ? 'madhu-vihar' : widgetState.location?.id;
  lockSlot(widgetState.date, locId, widgetState.time);

  // Save to backend if configured
  if (typeof saveBookingToBackend === 'function' && BOOKING_CONFIG.backend?.enabled) {
    saveBookingToBackend().catch(() => {});
  }

  widgetState.screen = 'success';
  renderWidget();

  // Open patient WhatsApp after 1s
  setTimeout(() => {
    const msg = buildSuccessWAMessage();
    window.open(
      `https://wa.me/${BOOKING_CONFIG.whatsapp.patientPhone}?text=${encodeURIComponent(msg)}`,
      '_blank', 'noopener,noreferrer'
    );
  }, 1000);

  // Open doctor WhatsApp after 2.5s
  setTimeout(() => {
    const doctorMsg = buildDoctorWAMessage();
    window.open(
      `https://wa.me/${BOOKING_CONFIG.whatsapp.doctorPhone}?text=${encodeURIComponent(doctorMsg)}`,
      '_blank', 'noopener,noreferrer'
    );
  }, 2500);
}

// ── WHATSAPP MESSAGES ─────────────────────────────────────────────────────────
function buildSuccessWAMessage() {
  const s = widgetState;
  const dl = formatDateForDisplay(s.date);
  const fee = s.type === 'video' ? '₹800' : (s.location?.fee || '₹800');
  return [
    `Hi Dr. Puja%27s Clinic! 🙏`,
    `I%27d like to confirm my appointment:`,
    ``,
    `👤 Name: ${s.name}`,
    `📱 Phone: +91 ${s.phone}`,
    `📋 Type: ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
    s.location && s.type !== 'video' ? `📍 Location: ${s.location.name}` : '',
    `📅 Date: ${dl}`,
    `⏰ Time: ${s.time}`,
    `💰 Fee: ${fee}`,
    s.reason ? `💬 Reason: ${s.reason}` : '',
  ].filter(Boolean).join('\n');
}

function buildDoctorWAMessage() {
  const s = widgetState;
  const dl = formatDateForDisplay(s.date);
  const fee = s.type === 'video' ? '₹800' : (s.location?.fee || '₹800');
  return [
    `🔔 *New Appointment*`,
    ``,
    `👤 Patient: ${s.name}`,
    `📱 Phone: +91 ${s.phone}`,
    `📋 Type: ${s.type === 'video' ? 'Video Consultation' : 'In-Clinic Visit'}`,
    s.location && s.type !== 'video' ? `📍 Location: ${s.location.name}` : '',
    `📅 Date: ${dl}`,
    `⏰ Time: ${s.time}`,
    `💰 Fee: ${fee}`,
    s.reason ? `💬 Reason: ${s.reason}` : '',
    ``,
    `— drpujaprasad.in`,
  ].filter(Boolean).join('\n');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatDateForDisplay(ds) {
  if (!ds) return '';
  return new Date(ds + 'T12:00:00')
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── HTML TEMPLATE (injected into index.html) ──────────────────────────────────
function injectBookingWidget() {
  // Remove old booking overlay if present
  const old = document.getElementById('bookingOverlay');
  if (old) old.remove();

  const div = document.createElement('div');
  div.innerHTML = `
    <div class="bw-overlay" id="bwOverlay" onclick="closeBookingOutside(event)"
         role="dialog" aria-modal="true" aria-label="Book an appointment"
         aria-labelledby="bwSheetTitle">
      <div class="bw-sheet" id="bwSheet" role="document">
        <div class="bw-drag-handle" aria-hidden="true"></div>
        <div class="bw-sheet-header">
          <h2 class="bw-sheet-title" id="bwSheetTitle">Book Appointment</h2>
          <button class="bw-close-btn" onclick="closeBooking()" aria-label="Close booking">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="bw-body" id="bwBody"></div>
      </div>
    </div>`;
  document.body.appendChild(div.firstElementChild);
}

// Init
document.addEventListener('DOMContentLoaded', injectBookingWidget);
