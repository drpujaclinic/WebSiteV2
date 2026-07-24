/**
 * DR. PUJA'S CLINIC — manage-booking.js
 * Patient self-service: login via email+phone OTP, view upcoming/past
 * appointments. Reschedule/cancel screens ship as a follow-up once this
 * is confirmed working end-to-end.
 * Depends on: booking.js (bwApi, escapeHTML), booking-widget.css (.bw-* classes)
 */
'use strict';

const mbState = {
    screen: 'login', // 'login' | 'otp' | 'list'
    email: '', phone: '', otp: '',
    otpTimer: null, otpSeconds: 30,
    patient: null,
    appointments: { upcoming: [], past: [] },
};

function openManageBooking() {
    const overlay = document.getElementById('mbOverlay');
    if (!overlay) return;
    Object.assign(mbState, { screen: 'login', email: '', phone: '', otp: '' });
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
    switch (mbState.screen) {
        case 'login': body.innerHTML = renderMbLoginScreen(); break;
        case 'otp': body.innerHTML = renderMbOtpScreen(); break;
        case 'list': body.innerHTML = renderMbListScreen(); break;
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
    mbState.otpSeconds = 30;
    const resendBtn = document.getElementById('mbResendBtn');
    if (resendBtn) resendBtn.disabled = true;
    mbState.otpTimer = setInterval(() => {
        mbState.otpSeconds--;
        const valEl = document.getElementById('mbTimerVal');
        if (valEl) valEl.textContent = `0:${String(mbState.otpSeconds).padStart(2, '0')}`;
        if (mbState.otpSeconds <= 0) {
            clearInterval(mbState.otpTimer);
            if (resendBtn) resendBtn.disabled = false;
        }
    }, 1000);
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
    if (res.success) mbState.appointments = { upcoming: res.upcoming || [], past: res.past || [] };
}

function renderMbListScreen() {
    const { upcoming, past } = mbState.appointments;
    const card = (a) => `
    <div class="bw-summary-card" style="margin:0 var(--bw-pad) 12px;">
      <div class="bw-summary-row"><span class="bw-summary-label">Booking ID</span><span class="bw-summary-val">${escapeHTML(a.booking_ref)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Date &amp; Time</span><span class="bw-summary-val">${new Date(a.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${escapeHTML(a.time)}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Location</span><span class="bw-summary-val">${a.consult_type === 'video' ? 'Video' : escapeHTML(a.location?.name || '')}</span></div>
      <div class="bw-summary-row"><span class="bw-summary-label">Status</span><span class="bw-summary-val" style="text-transform:capitalize;">${escapeHTML(a.status)}</span></div>
      ${a.status === 'confirmed' ? `
      <div style="display:flex;gap:8px;padding:10px 14px 4px;">
        <button class="btn btn-outline btn-sm" onclick="alert('Reschedule flow coming next — not yet wired.')">Reschedule</button>
        <button class="btn btn-outline btn-sm" onclick="alert('Cancel flow coming next — not yet wired.')">Cancel</button>
      </div>` : ''}
    </div>`;

    return `
    <div class="bw-sheet-header" style="padding:0 0 16px;border:none;">
      <span class="bw-screen-title">Hi ${escapeHTML(mbState.patient?.name || 'there')}</span>
    </div>
    <div style="padding:0 var(--bw-pad) 8px;font-size:12px;font-weight:700;color:#8fa8ad;text-transform:uppercase;letter-spacing:0.08em;">Upcoming</div>
    ${upcoming.length ? upcoming.map(card).join('') : `<p style="padding:0 var(--bw-pad) 16px;font-size:13px;color:#8fa8ad;">No upcoming appointments.</p>`}
    ${past.length ? `<div style="padding:8px var(--bw-pad) 8px;font-size:12px;font-weight:700;color:#8fa8ad;text-transform:uppercase;letter-spacing:0.08em;">Past</div>${past.map(card).join('')}` : ''}
  `;
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
          <h2 class="bw-sheet-title">Manage Booking</h2>
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