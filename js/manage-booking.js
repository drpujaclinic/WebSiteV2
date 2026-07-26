/**
 * DR. PUJA'S CLINIC — manage-booking.js
 * Patient self-service: login via email+phone OTP, view upcoming/past
 * appointments. Reschedule/cancel screens ship as a follow-up once this
 * is confirmed working end-to-end.
 * Depends on: booking.js (bwApi, escapeHTML), booking-widget.css (.bw-* classes)
 */
'use strict';

const mbState = {
    screen: 'login', // 'login' | 'otp' | 'list' | 'reschedule' | 'cancel'
    email: '', phone: '', otp: '',
    otpTimer: null, otpSeconds: 30,
    patient: null,
    appointments: { upcoming: [], past: [] },
    actionTarget: null,
    cancelReason: '',
    lastAction: null, // null | 'rescheduled' | 'cancelled' — drives the one-time success header
    reschedule: {
        date: '', time: null,
        slotsData: { morning: [], evening: [] }, slotsLoading: false,
        slotsExpanded: false,
        reservationToken: null, reservationExpiresAt: null,
    },
};

function mbSetHeaderTitle(text) {
    const el = document.getElementById('mbSheetTitle');
    if (el) el.textContent = text;
}

function mbFindAppointment(ref) {
    return [...mbState.appointments.upcoming, ...mbState.appointments.past].find(a => a.booking_ref === ref) || null;
}

function openManageBooking() {
    const overlay = document.getElementById('mbOverlay');
    if (!overlay) return;
    Object.assign(mbState, { screen: 'login', email: '', phone: '', otp: '', lastAction: null });
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderMbWidget();
    requestAnimationFrame(() => document.getElementById('mbSheet')?.classList.add('in'));
}

function closeManageBooking() {
    const overlay = document.getElementById('mbOverlay');
    const sheet = document.getElementById('mbSheet');
    clearInterval(mbState.otpTimer);
    if (sheet) {
        sheet.classList.remove('in');
        setTimeout(() => { overlay.classList.remove('open'); document.body.style.overflow = ''; }, 300);
    } else {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function closeMbOutside(e) {
    if (e.target === document.getElementById('mbOverlay')) closeManageBooking();
}

function renderMbWidget() {
    const body = document.getElementById('mbBody');
    if (!body) return;
    const titles = {
        login: 'Manage Booking', otp: 'Manage Booking',
        list: mbState.lastAction === 'rescheduled' ? 'Appointment Rescheduled'
            : mbState.lastAction === 'cancelled' ? 'Appointment Cancelled'
                : 'Manage Booking',
        reschedule: `Manage Booking: Reschedule - ${mbState.actionTarget?.booking_ref || ''}`,
        cancel: `Manage Booking: Cancel - ${mbState.actionTarget?.booking_ref || ''}`,
    };
    mbSetHeaderTitle(titles[mbState.screen] || 'Manage Booking');
    switch (mbState.screen) {
        case 'login': body.innerHTML = renderMbLoginScreen(); break;
        case 'otp': body.innerHTML = renderMbOtpScreen(); break;
        case 'list': body.innerHTML = renderMbListScreen(); break;
        case 'reschedule': body.innerHTML = renderMbRescheduleScreen(); break;
        case 'cancel': body.innerHTML = renderMbCancelScreen(); break;
    }
    if (mbState.screen === 'reschedule') {
        mbRefreshSlots(mbState.reschedule.date);
        mbAttachDateScrollListener();
    }
    if (mbState.screen === 'login') {
        requestAnimationFrame(() => document.getElementById('mbEmail')?.focus());
    }
    if (mbState.screen === 'otp') {
        requestAnimationFrame(() => document.getElementById('mbOTPBox0')?.focus());
        startMbOtpTimer();
    }
}

function renderMbLoginScreen() {
    return `
    <p style="font-size:13px;color:#2c4a50;padding:16px var(--bw-pad) 16px;margin:0;">Enter the email and mobile number you used when booking to verify it's you.</p>

    <div class="bw-form-group">
      <label class="bw-form-label" for="mbEmail">Email Address *</label>
      <input type="email" id="mbEmail" class="bw-form-input" placeholder="your@email.com" autocomplete="email"
             value="${escapeHTML(mbState.email)}" oninput="mbCheckLoginInput()" aria-required="true">
    </div>
    <div class="bw-form-group">
      <label class="bw-form-label" for="mbPhone">Mobile Number *</label>
      <div class="bw-phone-input-row">
        <div class="bw-country-code" aria-label="India +91"><span class="bw-flag">🇮🇳</span><span>+91</span></div>
        <input type="tel" id="mbPhone" class="bw-phone-input" placeholder="10-digit mobile number"
               maxlength="10" inputmode="numeric" autocomplete="tel-national"
               value="${escapeHTML(mbState.phone)}" oninput="mbCheckLoginInput()" aria-required="true">
      </div>
      <div class="bw-phone-error" id="mbLoginError" role="alert" aria-live="polite"></div>
    </div>

    <button class="bw-primary-btn" id="mbSendOTPBtn" onclick="mbSendOtp()" disabled>Send Verification Code</button>
  `;
}

function mbCheckLoginInput() {
    const emailEl = document.getElementById('mbEmail');
    const phoneEl = document.getElementById('mbPhone');
    if (phoneEl) phoneEl.value = phoneEl.value.replace(/\D/g, '').slice(0, 10);
    mbState.email = emailEl ? emailEl.value.trim() : mbState.email;
    mbState.phone = phoneEl ? phoneEl.value : mbState.phone;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mbState.email);
    const phoneValid = /^[6-9]\d{9}$/.test(mbState.phone);
    const btn = document.getElementById('mbSendOTPBtn');
    if (btn) btn.disabled = !(emailValid && phoneValid);
}

async function mbSendOtp() {
    const btn = document.getElementById('mbSendOTPBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const res = await bwApi('/email-send-otp.php', { method: 'POST', body: { email: mbState.email } });
    if (btn) { btn.disabled = false; btn.textContent = 'Send Verification Code'; }
    if (!res.success) {
        const err = document.getElementById('mbLoginError');
        if (err) err.textContent = res.error || 'Could not send the code. Please try again.';
        return;
    }
    mbState.screen = 'otp';
    mbState.otp = '';
    renderMbWidget();
}

function renderMbOtpScreen() {
    return `
    <div class="bw-back-row">
      <button class="bw-back-btn" onclick="mbState.screen='login';renderMbWidget();" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title">Enter Verification Code</span>
    </div>
    <div class="bw-otp-wrap">
      <p class="bw-otp-label">Verification code sent to <strong>${escapeHTML(mbState.email)}</strong></p>
      <div class="bw-otp-input-group" role="group" aria-label="6-digit OTP">
        ${[0, 1, 2, 3, 4, 5].map(i => `<input type="tel" maxlength="1" inputmode="numeric" class="bw-otp-box" id="mbOTPBox${i}"
          onkeydown="mbOtpKey(event,${i})" oninput="mbOtpInput(event,${i})">`).join('')}
      </div>
      <div class="bw-otp-error" id="mbOTPError" role="alert" aria-live="polite"></div>
      <div class="bw-otp-timer" id="mbOTPTimer">Resend code in <strong id="mbTimerVal">0:30</strong></div>
      <button class="bw-resend-btn" id="mbResendBtn" onclick="mbResendOtp()" disabled>Resend Code</button>
    </div>
    <button class="bw-primary-btn" id="mbVerifyBtn" onclick="mbVerifyOtp()" disabled>Verify &amp; Continue</button>
  `;
}

function mbOtpKey(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) document.getElementById(`mbOTPBox${idx - 1}`)?.focus();
}
function mbOtpInput(e, idx) {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    if (val && idx < 5) document.getElementById(`mbOTPBox${idx + 1}`)?.focus();
    let otp = '';
    for (let i = 0; i < 6; i++) otp += document.getElementById(`mbOTPBox${i}`)?.value || '';
    mbState.otp = otp;
    const btn = document.getElementById('mbVerifyBtn');
    if (btn) btn.disabled = otp.length < 6;
}

function startMbOtpTimer() {
    clearInterval(mbState.otpTimer);
    const resendBtn = document.getElementById('mbResendBtn');
    if (resendBtn) resendBtn.disabled = true;
    const deadline = Date.now() + 30000;

    function tick() {
        const secLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const valEl = document.getElementById('mbTimerVal');
        if (!valEl) { clearInterval(mbState.otpTimer); return; } // screen changed away — stop silently
        valEl.textContent = `0:${String(secLeft).padStart(2, '0')}`;
        if (secLeft <= 0) {
            clearInterval(mbState.otpTimer);
            const btn = document.getElementById('mbResendBtn');
            if (btn) btn.disabled = false;
        }
    }
    tick();
    mbState.otpTimer = setInterval(tick, 1000);
}

async function mbResendOtp() {
    for (let i = 0; i < 6; i++) { const b = document.getElementById(`mbOTPBox${i}`); if (b) b.value = ''; }
    mbState.otp = '';
    await bwApi('/email-send-otp.php', { method: 'POST', body: { email: mbState.email } });
    startMbOtpTimer();
}

async function mbVerifyOtp() {
    if (mbState.otp.length < 6) return;
    const btn = document.getElementById('mbVerifyBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
    const res = await bwApi('/email-verify-otp.php', { method: 'POST', body: { email: mbState.email, phone: mbState.phone, otp: mbState.otp } });
    if (btn) { btn.disabled = false; btn.textContent = 'Verify & Continue'; }
    if (!res.success) {
        const err = document.getElementById('mbOTPError');
        if (err) err.textContent = res.error || 'Incorrect code. Please try again.';
        return;
    }
    clearInterval(mbState.otpTimer);
    mbState.patient = res.patient;
    await mbLoadAppointments();
    mbState.screen = 'list';
    renderMbWidget();
}

async function mbLoadAppointments() {
    const res = await bwApi('/profile.php', { method: 'GET' });
    if (res.success) {
        mbState.appointments = { upcoming: res.upcoming || [], past: res.past || [] };
        if (res.patient) mbState.patient = res.patient; // always trust the DB's current name, not the login-time snapshot
    }
}

function renderMbListScreen() {
    const { upcoming, past } = mbState.appointments;
    const name = escapeHTML(mbState.patient?.name || 'there');
    mbState.lastAction = null; // shown once — clears once this screen renders

    const card = (a) => `
    <div class="bw-summary-card" style="margin:0 var(--bw-pad) 10px;">
      <div class="bw-summary-row"><span class="bw-summary-label">Booking ID</span><span class="bw-summary-val">${escapeHTML(a.booking_ref)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Date &amp; Time</span><span class="bw-summary-val">${new Date(a.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${escapeHTML(a.time)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Location</span><span class="bw-summary-val">${a.consult_type === 'video' ? 'Video' : escapeHTML(a.location?.name || '')}</span></div>
      ${a.status !== 'confirmed' ? `<div class="bw-summary-row"><span class="bw-summary-label">Status</span><span class="bw-summary-val" style="text-transform:capitalize;">${escapeHTML(a.status)}</span></div>` : ''}
      ${a.status === 'confirmed' ? `
      <div style="display:flex;gap:8px;padding:10px 14px 4px;">
        <button class="btn btn-outline btn-sm" onclick="mbOpenReschedule('${a.booking_ref}')">Reschedule</button>
        <button class="btn btn-outline btn-sm" onclick="mbOpenCancel('${a.booking_ref}')">Cancel</button>
      </div>` : ''}
    </div>`;

    if (upcoming.length === 0) {
        return `
      <p style="padding:16px var(--bw-pad);font-size:14px;color:#12282d;margin:0;">Hi ${name} — No upcoming appointments.</p>
      ${past.length ? renderMbPastAccordion(past, card) : ''}
    `;
    }

    return `
    <div style="padding:16px var(--bw-pad) 4px;font-size:14px;color:#12282d;font-weight:600;">Hi ${name}</div>
    <div style="padding:0 var(--bw-pad) 8px;font-size:12px;font-weight:700;color:#5c7a80;text-transform:uppercase;letter-spacing:0.08em;">Upcoming · Confirmed</div>
    ${upcoming.map(card).join('')}
    ${past.length ? renderMbPastAccordion(past, card) : ''}
  `;
}

function renderMbPastAccordion(past, cardFn) {
    return `
    <details class="mb-past-details">
      <summary>Past (${past.length})</summary>
      <div style="padding-top:4px;">${past.map(cardFn).join('')}</div>
    </details>
  `;
}

// ── CANCEL FLOW ──────────────────────────────────────────────────────────
function mbOpenCancel(ref) {
    mbState.actionTarget = mbFindAppointment(ref);
    mbState.cancelReason = '';
    mbState.screen = 'cancel';
    renderMbWidget();
}

function renderMbCancelScreen() {
    const a = mbState.actionTarget;
    if (!a) { mbState.screen = 'list'; renderMbWidget(); return ''; }
    return `
    <div class="bw-back-row" style="padding-top:12px;">
      <button class="bw-back-btn" onclick="mbState.screen='list';renderMbWidget();" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
    </div>
    <div class="bw-summary-card" style="margin:0 var(--bw-pad) 16px;">
      <div class="bw-summary-row"><span class="bw-summary-label">Booking ID</span><span class="bw-summary-val">${escapeHTML(a.booking_ref)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Date &amp; Time</span><span class="bw-summary-val">${new Date(a.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${escapeHTML(a.time)}</span></div>
    </div>
    <p style="padding:0 var(--bw-pad) 4px;font-size:14px;color:#12282d;font-weight:600;">Are you sure you want to cancel this appointment?</p>
    <p style="padding:0 var(--bw-pad) 16px;font-size:12px;color:#5c7a80;">This cannot be undone. You'll need to book a new slot if you change your mind.</p>
    <div class="bw-form-group">
      <label class="bw-form-label" for="mbCancelReason">Reason <span class="bw-optional">(optional)</span></label>
      <input type="text" id="mbCancelReason" class="bw-form-input" placeholder="e.g. Schedule conflict" oninput="mbState.cancelReason=this.value">
    </div>
    <div class="bw-confirm-error" id="mbCancelError" role="alert" aria-live="polite" style="color:#e34948;font-size:12px;text-align:center;padding:0 20px 8px;"></div>
    <div style="display:flex;gap:10px;padding:8px var(--bw-pad) 0;">
      <button class="bw-done-btn" style="flex:1;" onclick="mbState.screen='list';renderMbWidget();">Keep Appointment</button>
      <button class="bw-primary-btn bw-confirm-btn" style="flex:1;margin:0;" id="mbCancelConfirmBtn" onclick="mbConfirmCancel()">Yes, Cancel</button>
    </div>
  `;
}

async function mbConfirmCancel() {
    const btn = document.getElementById('mbCancelConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Cancelling…'; }
    const res = await bwApi('/cancel.php', {
        method: 'POST',
        body: { booking_ref: mbState.actionTarget.booking_ref, reason: mbState.cancelReason || '' },
    });
    if (!res.success) {
        if (btn) { btn.disabled = false; btn.textContent = 'Yes, Cancel'; }
        const err = document.getElementById('mbCancelError');
        if (err) err.textContent = res.error || 'Could not cancel. Please try again.';
        return;
    }
    mbState.lastAction = 'cancelled';
    await mbLoadAppointments();
    mbState.actionTarget = null;
    mbState.screen = 'list';
    renderMbWidget();
}

// ── RESCHEDULE FLOW ──────────────────────────────────────────────────────
function mbOpenReschedule(ref) {
    const appt = mbFindAppointment(ref);
    if (!appt) return;
    mbState.actionTarget = appt;
    mbState.reschedule = {
        date: todayDateStr(), time: null,
        slotsData: { morning: [], evening: [] }, slotsLoading: false, slotsExpanded: false,
        reservationToken: null, reservationExpiresAt: null,
        locationSlug: appt.consult_type === 'video' ? 'madhu-vihar' : (appt.location?.slug || 'madhu-vihar'),
    };
    mbState.screen = 'reschedule';
    renderMbWidget();
}

function mbRescheduleLocationSlug() {
    return mbState.reschedule.locationSlug || 'madhu-vihar';
}

function renderMbLocationSwitcher() {
    if (mbRescheduleConsultType() !== 'in_person') return '';
    const current = mbState.reschedule.locationSlug;
    return `
    <div class="mb-loc-switcher" role="group" aria-label="Switch clinic location">
      ${LOCATIONS.map(l => `<button class="bw-loc-pill ${current === l.id ? 'active' : ''}"
        onclick="mbSwitchLocation('${l.id}')" aria-pressed="${current === l.id}">${l.name.split(',')[0]}</button>`).join('')}
    </div>
  `;
}

function mbSwitchLocation(slug) {
    if (mbState.reschedule.locationSlug === slug) return;
    mbState.reschedule.locationSlug = slug;
    mbState.reschedule.time = null;
    mbState.reschedule.slotsExpanded = false;
    const body = document.getElementById('mbBody');
    if (body) body.innerHTML = renderMbRescheduleScreen();
    mbAttachDateScrollListener();
}

function mbRescheduleConsultType() {
    return mbState.actionTarget?.consult_type === 'video' ? 'video' : 'in_person';
}

function renderMbRescheduleScreen() {
    const a = mbState.actionTarget;
    if (!a) { mbState.screen = 'list'; renderMbWidget(); return ''; }
    return `
    <div class="bw-back-row" style="padding-top:12px;">
      <button class="bw-back-btn" onclick="mbState.screen='list';renderMbWidget();" aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bw-screen-title" style="font-size:13px;color:#5c7a80;font-weight:500;">Choose a clinic to see its hours</span>
    </div>
    ${renderMbLocationSwitcher()}
    <div class="bw-date-strip mb-date-strip-pinned" role="group" aria-label="Select a new date">
      <div class="bw-date-month" id="mbDateMonth" aria-hidden="true">${MB_MONTHS[new Date().getMonth()]}</div>
      <div class="bw-date-scroll" id="mbDateScroll">${mbBuildDateStrip()}</div>
    </div>
    <div class="bw-slots-section" id="mbSlotsSection" aria-live="polite" style="padding-top:4px;">${mbRenderSlotsHTML()}</div>
    <div class="bw-confirm-error" id="mbRescheduleError" role="alert" aria-live="polite" style="color:#e34948;font-size:12px;text-align:center;padding:0 20px 8px;"></div>
  `;
}

const MB_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function mbBuildDateStrip() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const items = [];
    for (let i = 0; i < 10; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const ds = formatDateStr(d);
        const isSelected = mbState.reschedule.date === ds;
        const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tom' : String(d.getDate());
        items.push(`<button class="bw-date-pill ${isSelected ? 'selected' : ''}" data-month="${d.getMonth()}" onclick="mbSelectDate('${ds}')"
      aria-label="${days[d.getDay()]} ${d.getDate()} ${MB_MONTHS[d.getMonth()]}" aria-pressed="${isSelected}">
      <span class="bw-date-label">${dayLabel}</span><span class="bw-date-day">${days[d.getDay()]}</span></button>`);
    }
    return items.join('');
}

function mbAttachDateScrollListener() {
    const strip = document.getElementById('mbDateScroll');
    if (!strip) return;
    if (!strip._mbObserver) {
        // Narrow the detection zone to a thin strip at the container's left
        // edge — only the pill actually sitting there counts as "current",
        // rather than comparing overall visibility % across the whole strip
        // (which flips a beat early as the next pill scrolls in).
        strip._mbObserver = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting);
            if (!visible.length) return;
            const leftmost = visible.reduce((a, b) =>
                a.boundingClientRect.left <= b.boundingClientRect.left ? a : b
            );
            const label = document.getElementById('mbDateMonth');
            if (label) label.textContent = MB_MONTHS[Number(leftmost.target.getAttribute('data-month'))];
        }, { root: strip, rootMargin: '0px -70% 0px 0%', threshold: 0 });
    }

    function mbObserveDatePills() {
        const strip = document.getElementById('mbDateScroll');
        if (!strip || !strip._mbObserver) return;
        strip._mbObserver.disconnect();
        strip.querySelectorAll('.bw-date-pill').forEach(p => strip._mbObserver.observe(p));
    }

    function mbSlotPill(time) {
        const selected = mbState.reschedule.time === time;
        return `<button class="bw-slot ${selected ? 'selected' : ''}" onclick="mbSelectSlot('${time}')" aria-pressed="${selected}">${time}</button>`;
    }

    const MB_SLOTS_PREVIEW_COUNT = 6;

    function mbRenderSlotsHTML() {
        const { slotsData, slotsExpanded } = mbState.reschedule;
        const { morning, evening } = slotsData;
        if (mbState.reschedule.slotsLoading) return `<div class="bw-no-slots">Loading times…</div>`;
        const total = morning.length + evening.length;
        if (total === 0) return `<div class="bw-no-slots">No slots available on this date. Please choose another date.</div>`;

        const all = [...morning.map(t => ({ t, group: 'Morning' })), ...evening.map(t => ({ t, group: 'Evening' }))];
        const shown = slotsExpanded ? all : all.slice(0, MB_SLOTS_PREVIEW_COUNT);

        const groups = {};
        shown.forEach(({ t, group }) => { (groups[group] = groups[group] || []).push(t); });

        const groupsHTML = Object.entries(groups).map(([label, times]) =>
            `<div class="bw-slot-group"><div class="bw-slot-group-label">${label}</div><div class="mb-slots-grid">${times.map(mbSlotPill).join('')}</div></div>`
        ).join('');

        const moreBtn = !slotsExpanded && all.length > MB_SLOTS_PREVIEW_COUNT
            ? `<button class="mb-view-more-btn" onclick="mbState.reschedule.slotsExpanded=true;document.getElementById('mbSlotsSection').innerHTML=mbRenderSlotsHTML();">View more slots (${all.length - MB_SLOTS_PREVIEW_COUNT} more)</button>`
            : '';

        return `<div class="bw-slots-expanded">${groupsHTML}</div>${moreBtn}`;
    }

    function mbSelectDate(ds) {
        mbState.reschedule.date = ds;
        mbState.reschedule.time = null;
        mbState.reschedule.slotsExpanded = false;
        document.getElementById('mbRescheduleConfirmBar')?.remove();
        const strip = document.getElementById('mbDateScroll');
        if (strip) strip.innerHTML = mbBuildDateStrip();
        mbObserveDatePills();
        requestAnimationFrame(() => {
            const sel = document.querySelector('#mbDateScroll .bw-date-pill.selected');
            if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        });
        mbRefreshSlots(ds);
    }

    async function mbRefreshSlots(date) {
        mbState.reschedule.slotsLoading = true;
        const el = document.getElementById('mbSlotsSection');
        if (el) el.innerHTML = mbRenderSlotsHTML();

        const res = await bwApi(`/check-slots.php?location=${mbRescheduleLocationSlug()}&date=${date}&type=${mbRescheduleConsultType()}`);
        if (mbState.reschedule.date !== date) return; // stale response guard

        mbState.reschedule.slotsLoading = false;
        mbState.reschedule.slotsData = res.success ? res.slots : { morning: [], evening: [] };
        const el2 = document.getElementById('mbSlotsSection');
        if (el2) el2.innerHTML = mbRenderSlotsHTML();
    }

    async function mbSelectSlot(time) {
        const date = mbState.reschedule.date;
        const bookingRef = mbState.actionTarget.booking_ref;

        const el = document.getElementById('mbSlotsSection');
        if (el) el.innerHTML = `<div class="bw-no-slots">Rescheduling…</div>`;

        const lock = await bwApi('/lock-slot.php', {
            method: 'POST',
            body: { location: mbRescheduleLocationSlug(), date, time, consult_type: mbRescheduleConsultType() },
        });

        if (!lock.success) {
            const err = document.getElementById('mbRescheduleError');
            if (err) err.textContent = lock.error || 'That slot is no longer available. Please pick another.';
            mbRefreshSlots(date);
            return;
        }

        const res = await bwApi('/reschedule.php', {
            method: 'POST',
            body: { booking_ref: bookingRef, reservation_token: lock.reservation_token },
        });

        if (!res.success) {
            const err = document.getElementById('mbRescheduleError');
            if (err) err.textContent = res.error || 'Could not reschedule. Please try again.';
            mbRefreshSlots(date);
            return;
        }

        mbState.lastAction = 'rescheduled';
        await mbLoadAppointments();
        mbState.actionTarget = null;
        mbState.screen = 'list';
        renderMbWidget();
    }

    function injectManageBookingWidget() {
        const old = document.getElementById('mbOverlay');
        if (old) old.remove();
        const div = document.createElement('div');
        div.innerHTML = `
    <div class="bw-overlay" id="mbOverlay" onclick="closeMbOutside(event)" role="dialog" aria-modal="true" aria-label="Manage your booking">
      <div class="bw-sheet" id="mbSheet" role="document">
        <div class="bw-drag-handle" aria-hidden="true"></div>
        <div class="bw-sheet-header">
          <h2 class="bw-sheet-title" id="mbSheetTitle">Manage Booking</h2>
          <button class="bw-close-btn" onclick="closeManageBooking()" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="bw-body" id="mbBody"></div>
      </div>
    </div>`;
        document.body.appendChild(div.firstElementChild);
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectManageBookingWidget();
        if (location.hash.replace('#', '') === 'manage-booking') openManageBooking();
    });