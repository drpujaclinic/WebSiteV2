/**
 * DR. PUJA'S CLINIC — fertility-questionnaire.js (v2 — 4-step wizard)
 * Online version of the Couple Fertility Checklist. Self-check only — no
 * score, no diagnosis. Server computes per-section status + lifestyle tips;
 * this file only renders what the server returns, plus a client-side
 * aggregate rollup of that same data (not a new scoring system).
 * Depends on: booking.js (bwApi, escapeHTML)
 */
'use strict';

// Keys/order must match backend $SECTIONS exactly.
const FQ_SECTIONS = {
  reproductive_awareness: { label: 'Reproductive Health Awareness', items: [
    ['r1', "We know the female partner's usual cycle length and pattern."],
    ['r2', 'We can identify approximately when ovulation may occur.'],
    ['r3', 'We understand that the fertile window is limited.'],
    ['r4', 'We know when to seek fertility evaluation rather than delaying indefinitely.'],
    ['r5', 'We have discussed our reproductive goals and preferred timeline.'],
  ]},
  preconception_health: { label: 'Preconception Health', items: [
    ['p1', 'We have reviewed important medical conditions with a clinician.'],
    ['p2', 'Regular medications and supplements have been reviewed for pregnancy planning.'],
    ['p3', 'Recommended vaccinations/preconception care have been considered.'],
    ['p4', 'Folic acid supplementation has been discussed for the person who may become pregnant.'],
    ['p5', 'Dental and general health concerns are being addressed where appropriate.'],
  ]},
  nutrition: { label: 'Nutrition', items: [
    ['n1', 'Most meals contain vegetables/fruits and minimally processed foods.'],
    ['n2', 'We include adequate protein from suitable sources.'],
    ['n3', 'We regularly include whole grains, pulses/legumes, nuts or seeds as appropriate.'],
    ['n4', 'We limit frequent ultra-processed foods and sugary drinks.'],
    ['n5', "We avoid unregulated 'fertility boosters' or supplements without medical advice."],
  ]},
  weight_metabolic: { label: 'Weight & Metabolic Health', items: [
    ['w1', 'We know whether our current weight is appropriate for our health goals.'],
    ['w2', 'We are working toward a healthy, sustainable weight if advised.'],
    ['w3', 'Diabetes, thyroid disease or other relevant metabolic issues are appropriately managed.'],
    ['w4', 'We are avoiding crash diets and extreme weight-loss programs.'],
  ]},
  movement_fitness: { label: 'Movement & Fitness', items: [
    ['m1', 'We are physically active on most days of the week.'],
    ['m2', 'We include appropriate aerobic activity and/or strength work.'],
    ['m3', 'We break up long periods of sitting.'],
    ['m4', 'Our exercise plan is realistic and sustainable.'],
  ]},
  sleep_recovery: { label: 'Sleep & Recovery', items: [
    ['s1', 'We usually get adequate sleep.'],
    ['s2', 'Our sleep/wake timing is reasonably consistent.'],
    ['s3', 'We address persistent snoring, severe daytime sleepiness or other sleep concerns with a clinician.'],
    ['s4', "We protect some time for recovery rather than constantly operating in 'work mode'."],
  ]},
  stress_relationship: { label: 'Stress & Relationship', items: [
    ['st1', 'We have a healthy way to manage daily stress.'],
    ['st2', 'We make time for connection as a couple outside fertility planning.'],
    ['st3', 'We avoid blaming each other for difficulty conceiving.'],
    ['st4', 'Trying to conceive has not become the only focus of our relationship.'],
    ['st5', 'We know where to seek emotional support if the process becomes overwhelming.'],
  ]},
  exposures: { label: 'Tobacco, Alcohol & Other Exposures', items: [
    ['e1', 'Neither partner uses tobacco/nicotine, or a cessation plan is underway.'],
    ['e2', 'Alcohol intake is minimized/avoided appropriately while planning pregnancy.'],
    ['e3', 'Recreational drugs are avoided.'],
    ['e4', 'Occupational/environmental exposures relevant to reproductive health have been reviewed when applicable.'],
    ['e5', 'We discuss significant medication or supplement exposures with a clinician.'],
  ]},
  male_fertility: { label: 'Male Fertility Check', items: [
    ['mf1', 'We understand that male factors can contribute to infertility.'],
    ['mf2', 'Tobacco/nicotine exposure has been addressed.'],
    ['mf3', 'Weight, exercise, sleep and metabolic health are being optimized.'],
    ['mf4', 'Relevant medications, heat/occupational exposures or prior reproductive problems have been reviewed if applicable.'],
    ['mf5', 'Semen analysis is considered when clinically indicated rather than assuming the issue is female.'],
  ]},
  female_fertility: { label: 'Female Fertility Check', items: [
    ['ff1', 'Menstrual cycles are tracked for pattern and regularity.'],
    ['ff2', 'Irregular/absent periods have been discussed with a clinician.'],
    ['ff3', 'Severe period pain or symptoms suggestive of endometriosis have been discussed.'],
    ['ff4', 'Previous pelvic infection, surgery or known tubal problems have been considered.'],
    ['ff5', 'Age and reproductive timeline have been considered in planning.'],
  ]},
};

const FQ_RED_FLAGS = [
  ['rf1', 'Female partner has irregular or absent periods.'],
  ['rf2', 'There is severe menstrual/pelvic pain or suspected endometriosis.'],
  ['rf3', 'There is known or suspected tubal disease or previous significant pelvic infection/surgery.'],
  ['rf4', 'There is known or suspected male reproductive dysfunction.'],
  ['rf5', 'There is a history of chemotherapy/radiation that may affect fertility.'],
  ['rf6', 'There are recurrent pregnancy losses or other significant reproductive concerns.'],
  ['rf7', 'There is sexual dysfunction that may interfere with conception.'],
  ['rf8', 'Age or other circumstances suggest that evaluation should begin earlier.'],
  ['rf9', 'You have been trying for an appropriate period without pregnancy and want professional guidance.'],
];

// 4-step grouping — content only, no scoring/meaning change.
const FQ_STEPS = [
  { title: 'Awareness & Health', sections: ['reproductive_awareness', 'preconception_health', 'nutrition'] },
  { title: 'Lifestyle & Wellbeing', sections: ['weight_metabolic', 'movement_fitness', 'sleep_recovery', 'stress_relationship'] },
  { title: 'Fertility Factors', sections: ['exposures', 'male_fertility', 'female_fertility'], includeRedFlags: true },
  { title: 'About You', isFinal: true },
];

const fqState = {
  screen: 'form', // 'form' | 'success'
  currentStep: 0,
  responses: {},       // persisted checkbox state across steps, keyed by item key
  demographics: { age1: '', age2: '', trying: '' },
  contactOptIn: false,
  contact: { name: '', phone: '', email: '' },
  fieldErrors: {},
  submitting: false,
  error: '',
  result: null,
};

function openFertilityQuestionnaire() {
  const overlay = document.getElementById('fqOverlay');
  if (!overlay) return;
  Object.assign(fqState, {
    screen: 'form', currentStep: 0, responses: {}, demographics: { age1: '', age2: '', trying: '' },
    contactOptIn: false, contact: { name: '', phone: '', email: '' }, fieldErrors: {},
    submitting: false, error: '', result: null,
  });
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderFqWidget();
  requestAnimationFrame(() => document.getElementById('fqSheet')?.classList.add('in'));
}

function closeFertilityQuestionnaire() {
  const overlay = document.getElementById('fqOverlay');
  const sheet = document.getElementById('fqSheet');
  if (sheet) {
    sheet.classList.remove('in');
    setTimeout(() => { overlay.classList.remove('open'); document.body.style.overflow = ''; }, 300);
  } else if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function closeFqOutside(e) {
  if (e.target === document.getElementById('fqOverlay')) closeFertilityQuestionnaire();
}

// ── Persist current step's inputs into fqState before navigating away ─────
function fqHarvestCurrentStep() {
  const step = FQ_STEPS[fqState.currentStep];
  if (!step) return;
  if (step.isFinal) {
    fqState.demographics.age1 = document.getElementById('fqAge1')?.value || '';
    fqState.demographics.age2 = document.getElementById('fqAge2')?.value || '';
    fqState.demographics.trying = document.getElementById('fqTrying')?.value || '';
    fqState.contactOptIn = document.getElementById('fqContactOptIn')?.checked || false;
    fqState.contact.name = document.getElementById('fqName')?.value.trim() || '';
    fqState.contact.phone = document.getElementById('fqPhone')?.value.trim() || '';
    fqState.contact.email = document.getElementById('fqEmail')?.value.trim() || '';
    return;
  }
  (step.sections || []).forEach(secKey => {
    FQ_SECTIONS[secKey].items.forEach(([key]) => {
      const el = document.getElementById(`fq_${key}`);
      if (el) fqState.responses[key] = el.checked;
    });
  });
  if (step.includeRedFlags) {
    FQ_RED_FLAGS.forEach(([key]) => {
      const el = document.getElementById(`fq_${key}`);
      if (el) fqState.responses[key] = el.checked;
    });
  }
}

function fqGoStep(delta) {
  fqHarvestCurrentStep();
  if (delta > 0) {
    const valid = fqValidateFinalStepIfNeeded();
    if (!valid) { renderFqWidget(); return; }
  }
  const next = fqState.currentStep + delta;
  if (next < 0 || next >= FQ_STEPS.length) return;
  fqState.currentStep = next;
  renderFqWidget();
  document.getElementById('fqStepBody')?.scrollTo({ top: 0 });
}

// Only the final step has genuine required-field validation (contact details,
// only when the person opted in). Steps 1-3 are a self-check — an unchecked
// box is legitimate data, not an incomplete answer, so nothing blocks
// progression there.
function fqValidateFinalStepIfNeeded() {
  const step = FQ_STEPS[fqState.currentStep];
  if (!step || !step.isFinal) return true;
  fqState.fieldErrors = {};
  if (!fqState.contactOptIn) return true;

  let ok = true;
  if (!fqState.contact.name) { fqState.fieldErrors.name = 'Please enter your name.'; ok = false; }
  if (!fqState.contact.phone) {
    fqState.fieldErrors.phone = 'Please enter a mobile number.'; ok = false;
  } else if (!/^[6-9]\d{9}$/.test(fqState.contact.phone)) {
    fqState.fieldErrors.phone = 'Enter a valid 10-digit Indian mobile number.'; ok = false;
  }
  if (!fqState.contact.email) {
    fqState.fieldErrors.email = 'Please enter an email address.'; ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fqState.contact.email)) {
    fqState.fieldErrors.email = 'Enter a valid email address.'; ok = false;
  }
  return ok;
}

function fqToggleContact() {
  const box = document.getElementById('fqContactFields');
  const checked = document.getElementById('fqContactOptIn')?.checked || false;
  if (box) box.style.display = checked ? 'block' : 'none';
}

function renderFqWidget() {
  const body = document.getElementById('fqBody');
  if (!body) return;
  body.innerHTML = fqState.screen === 'success' ? renderFqSuccess() : renderFqForm();
}

function fqSectionHTML(secKey) {
  const section = FQ_SECTIONS[secKey];
  return `
    <div class="fq-section">
      <h4>${escapeHTML(section.label)}</h4>
      ${section.items.map(([key, text]) => `
        <label class="fq-check-row">
          <input type="checkbox" id="fq_${key}" ${fqState.responses[key] ? 'checked' : ''}>
          <span>${escapeHTML(text)}</span>
        </label>
      `).join('')}
    </div>`;
}

function fqRedFlagsHTML() {
  return `
    <div class="fq-section fq-redflags">
      <h4>When Should We Seek Help?</h4>
      <p class="fq-redflags-note">Lifestyle improvement should complement \u2014 not replace \u2014 appropriate fertility
        evaluation. Check anything that applies to you \u2014 this isn't a diagnosis, just a signal worth acting on.</p>
      ${FQ_RED_FLAGS.map(([key, text]) => `
        <label class="fq-check-row">
          <input type="checkbox" id="fq_${key}" ${fqState.responses[key] ? 'checked' : ''}>
          <span>${escapeHTML(text)}</span>
        </label>
      `).join('')}
    </div>`;
}

function renderFqProgress() {
  const stepNum = fqState.currentStep + 1;
  const total = FQ_STEPS.length;
  const pct = Math.round((stepNum / total) * 100);
  return `
    <div class="fq-progress-wrap">
      <div class="fq-progress-label">Step ${stepNum} of ${total} \u2014 ${escapeHTML(FQ_STEPS[fqState.currentStep].title)}</div>
      <div class="fq-progress-track" role="progressbar" aria-valuenow="${stepNum}" aria-valuemin="1" aria-valuemax="${total}"
           aria-label="Step ${stepNum} of ${total}: ${escapeHTML(FQ_STEPS[fqState.currentStep].title)}">
        <div class="fq-progress-fill" style="width:${pct}%;"></div>
      </div>
    </div>`;
}

function renderFqStepContent() {
  const step = FQ_STEPS[fqState.currentStep];
  if (step.isFinal) {
    const fe = fqState.fieldErrors;
    return `
      <p class="fq-intro">Almost done \u2014 this last part is optional.</p>
      <div class="fq-section">
        <h4>A Little About You <span class="fq-optional">(optional)</span></h4>
        <div class="fq-demo-row">
          <div class="bw-form-group" style="flex:1;">
            <label class="bw-form-label" for="fqAge1">Partner 1 Age</label>
            <input type="number" id="fqAge1" class="bw-form-input" min="16" max="60" value="${escapeHTML(fqState.demographics.age1)}">
          </div>
          <div class="bw-form-group" style="flex:1;">
            <label class="bw-form-label" for="fqAge2">Partner 2 Age</label>
            <input type="number" id="fqAge2" class="bw-form-input" min="16" max="60" value="${escapeHTML(fqState.demographics.age2)}">
          </div>
        </div>
        <div class="bw-form-group">
          <label class="bw-form-label" for="fqTrying">Trying for (months)</label>
          <input type="number" id="fqTrying" class="bw-form-input" min="0" max="240" value="${escapeHTML(fqState.demographics.trying)}">
        </div>
      </div>

      <div class="fq-section" style="border-bottom:none;">
        <label class="fq-check-row fq-contact-toggle">
          <input type="checkbox" id="fqContactOptIn" onchange="fqToggleContact()" ${fqState.contactOptIn ? 'checked' : ''}>
          <span><strong>We're comfortable being contacted</strong> by Dr. Puja's Clinic about our results.
            <em style="font-style:normal;color:var(--ink-faint);font-weight:400;">(Click checkbox to enter details.)</em></span>
        </label>
        <div id="fqContactFields" style="display:${fqState.contactOptIn ? 'block' : 'none'};">
          <div class="bw-form-group">
            <label class="bw-form-label" for="fqName">Full Name *</label>
            <input type="text" id="fqName" class="bw-form-input ${fe.name ? 'fq-input-error' : ''}" value="${escapeHTML(fqState.contact.name)}" aria-required="true">
            <div class="fq-field-error" role="alert">${escapeHTML(fe.name || '')}</div>
          </div>
          <div class="bw-form-group">
            <label class="bw-form-label" for="fqPhone">Phone Number / WhatsApp *</label>
            <input type="tel" id="fqPhone" class="bw-form-input ${fe.phone ? 'fq-input-error' : ''}" maxlength="10" inputmode="numeric"
                   placeholder="10-digit mobile number" value="${escapeHTML(fqState.contact.phone)}" aria-required="true">
            <div class="fq-field-error" role="alert">${escapeHTML(fe.phone || '')}</div>
          </div>
          <div class="bw-form-group">
            <label class="bw-form-label" for="fqEmail">Email Address *</label>
            <input type="email" id="fqEmail" class="bw-form-input ${fe.email ? 'fq-input-error' : ''}" value="${escapeHTML(fqState.contact.email)}" aria-required="true">
            <div class="fq-field-error" role="alert">${escapeHTML(fe.email || '')}</div>
          </div>
          <p class="fq-privacy-note">Your responses are used only to give you this summary and, if you've opted in above,
            for the clinic to follow up. See our <a href="#privacy" onclick="closeFertilityQuestionnaire();showPage('privacy');return false;">Privacy Policy</a>.</p>
        </div>
      </div>
    `;
  }
  const sections = (step.sections || []).map(fqSectionHTML).join('');
  const redFlags = step.includeRedFlags ? fqRedFlagsHTML() : '';
  return sections + redFlags;
}

function renderFqForm() {
  const step = FQ_STEPS[fqState.currentStep];
  const isFirst = fqState.currentStep === 0;
  const isLast = fqState.currentStep === FQ_STEPS.length - 1;

  return `
    ${renderFqProgress()}
    <div class="fq-step-body" id="fqStepBody">
      ${fqState.currentStep === 0 ? `<p class="fq-intro">Complete this together \u2014 there's no score and no diagnosis.
        It takes about 5 minutes and helps you see, at a glance, where things already look solid and where you might
        want to focus.</p>` : ''}
      ${renderFqStepContent()}
      <div class="fq-error" role="alert" aria-live="polite">${escapeHTML(fqState.error)}</div>
    </div>
    <div class="fq-step-nav">
      ${!isFirst ? `<button class="bw-done-btn" onclick="fqGoStep(-1)">\u2190 Back</button>` : ''}
      ${!isLast
        ? `<button class="bw-primary-btn" onclick="fqGoStep(1)">Next \u2192</button>`
        : `<button class="bw-primary-btn" id="fqSubmitBtn" onclick="submitFertilityQuestionnaire()" ${fqState.submitting ? 'disabled' : ''}>
             ${fqState.submitting ? 'Submitting\u2026' : 'View Summary / Submit'}
           </button>`}
    </div>
  `;
}

function fqStatusLabel(status) {
  if (status === 'strong') return { text: 'Looking Strong', cls: 'fq-status-strong' };
  if (status === 'attention') return { text: 'Worth a Closer Look', cls: 'fq-status-attention' };
  return { text: 'Consider Focusing Here', cls: 'fq-status-focus' };
}

// Aggregate rollup of the server's own per-section statuses — not a new
// scoring system, just a plain-language summary of data already computed.
// Deliberately avoids "X of Y" ratio phrasing, which reads as a score even
// when it isn't meant as one.
function fqOverallHeadline(sections) {
  const counts = { strong: 0, attention: 0, focus: 0 };
  sections.forEach(s => counts[s.status]++);
  if (counts.focus === 0 && counts.attention === 0) return 'You\u2019re in a Strong Position';
  if (counts.focus === 0) return 'A Solid Foundation Overall';
  if (counts.strong === 0) return 'A Clear Starting Point';
  return 'A Good Mix of Strengths and Opportunities';
}

function fqOverallSubtext(strongCount, needsWorkCount) {
  if (needsWorkCount === 0) return "You're covering the fundamentals well \u2014 keep it up as you move forward.";
  if (strongCount === 0) return "There's a good amount to build on together, and that's completely normal at this stage \u2014 here's where to begin.";
  return "You're already doing well in several areas, and there are a few worth a bit more attention \u2014 nothing urgent, just things to keep in mind.";
}

function renderFqSuccess() {
  const r = fqState.result;
  if (!r) return '<p class="fq-intro">Something went wrong showing your summary \u2014 please check your email or contact the clinic.</p>';

  const strong = r.section_summary.filter(s => s.status === 'strong');
  const needsWork = r.section_summary.filter(s => s.status !== 'strong');
  const overall = fqOverallHeadline(r.section_summary);

  const redFlagBanner = r.needs_follow_up ? `
    <div class="fq-followup-banner">
      <strong>Based on a few of your answers, we'd recommend booking a consultation sooner rather than later.</strong>
      <p>This isn't a diagnosis \u2014 just a signal that it's worth having a clinician take a look now, rather than waiting.</p>
      <button class="btn btn-primary btn-sm fq-no-print" onclick="closeFertilityQuestionnaire();openBooking();">Book a Consultation</button>
    </div>` : '';

  const rowHTML = s => {
    const st = fqStatusLabel(s.status);
    return `
      <div class="fq-result-row">
        <div class="fq-result-head">
          <span>${escapeHTML(s.label)}</span>
          <span class="fq-status-pill ${st.cls}">${st.text}</span>
        </div>
        <p>${escapeHTML(s.tip)}</p>
      </div>`;
  };

  return `
    <div class="fq-success-wrap fq-print-area">
      <div class="fq-print-only fq-print-header">
        <img src="images/badges/obgyn-coe.jpg" alt="Dr. Puja's Clinic — OBGYN Centre of Excellence" width="48" height="48">
        <div>
          <div class="fq-print-clinic-name">Dr. Puja's Clinic</div>
          <div class="fq-print-clinic-sub">Gynaecology &amp; Fertility Centre</div>
        </div>
      </div>
      <div class="fq-success-tick fq-no-print" aria-hidden="true">\u2705</div>
      <h3>Thank You \u2014 Here's Your Summary</h3>
      <p class="fq-intro">This is a self-check, not a test result. Use it as a starting point for your own conversation
        \u2014 and with Dr. Puja, whenever you're ready.</p>

      <div class="fq-result-row" style="background:var(--teal-ghost);border-color:transparent;">
        <div class="fq-result-head"><span style="font-size:15px;">${escapeHTML(overall)}</span></div>
        <p>${escapeHTML(fqOverallSubtext(strong.length, needsWork.length))}</p>
      </div>

      ${redFlagBanner}

      ${needsWork.length ? `<h4 style="font-size:13px;margin:18px 0 8px;color:var(--ink);">Areas Needing Attention</h4>${needsWork.map(rowHTML).join('')}` : ''}
      ${strong.length ? `<h4 style="font-size:13px;margin:18px 0 8px;color:var(--ink);">Key Positive Areas</h4>${strong.map(rowHTML).join('')}` : ''}

      <div class="fq-no-print" style="display:flex;gap:10px;margin-top:16px;">
        <button class="bw-done-btn" style="flex:1;" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <button class="bw-primary-btn" style="flex:1;margin:0;" onclick="closeFertilityQuestionnaire();openBooking();">Book Appointment</button>
      </div>
      <button class="bw-done-btn fq-no-print" style="width:100%;margin-top:10px;" onclick="closeFertilityQuestionnaire()">Done</button>
      <p class="fq-print-only fq-print-copyright">© 2026 Dr. Puja's Clinic. All rights reserved. This is copyrighted material.</p>
    </div>
  `;
}

async function submitFertilityQuestionnaire() {
  fqHarvestCurrentStep();
  if (!fqValidateFinalStepIfNeeded()) {
    renderFqWidget();
    return;
  }

  fqState.submitting = true;
  fqState.error = '';
  renderFqWidget();

  const res = await bwApi('/submit-fertility-questionnaire.php', {
    method: 'POST',
    body: {
      responses: fqState.responses,
      contact_opt_in: fqState.contactOptIn,
      name: fqState.contact.name || null,
      phone: fqState.contact.phone || null,
      email: fqState.contact.email || null,
      partner1_age: fqState.demographics.age1 || null,
      partner2_age: fqState.demographics.age2 || null,
      trying_since_months: fqState.demographics.trying || null,
    },
  });

  fqState.submitting = false;

  if (!res.success) {
    fqState.error = res.error || 'Could not submit right now. Please try again.';
    renderFqWidget();
    return;
  }

  fqState.result = res;
  fqState.screen = 'success';
  renderFqWidget();
  document.getElementById('fqBody')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function injectFertilityQuestionnaireWidget() {
  const old = document.getElementById('fqOverlay');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="bw-overlay" id="fqOverlay" onclick="closeFqOutside(event)" role="dialog" aria-modal="true" aria-label="Fertility Readiness Questionnaire">
      <div class="bw-sheet" id="fqSheet" role="document" style="max-width:640px;">
        <div class="bw-drag-handle" aria-hidden="true"></div>
        <div class="bw-sheet-header">
          <h2 class="bw-sheet-title">Couple Fertility Readiness Check</h2>
          <button class="bw-close-btn" onclick="closeFertilityQuestionnaire()" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="bw-body fq-body" id="fqBody"></div>
      </div>
    </div>`;
  document.body.appendChild(div.firstElementChild);
}

document.addEventListener('DOMContentLoaded', injectFertilityQuestionnaireWidget);
