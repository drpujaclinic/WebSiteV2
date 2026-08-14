/**
 * DR. PUJA'S CLINIC — fertility-questionnaire.js
 * Online version of the Couple Fertility Checklist. Self-check only — no
 * score, no diagnosis. Server computes per-section status + lifestyle tips;
 * this file only renders what the server returns.
 * Depends on: booking.js (bwApi, escapeHTML)
 */
'use strict';

// Keys/order must match backend $SECTIONS exactly.
const FQ_SECTIONS = [
  { key: 'reproductive_awareness', label: 'Reproductive Health Awareness', items: [
    ['r1', "We know the female partner's usual cycle length and pattern."],
    ['r2', 'We can identify approximately when ovulation may occur.'],
    ['r3', 'We understand that the fertile window is limited.'],
    ['r4', 'We know when to seek fertility evaluation rather than delaying indefinitely.'],
    ['r5', 'We have discussed our reproductive goals and preferred timeline.'],
  ]},
  { key: 'preconception_health', label: 'Preconception Health', items: [
    ['p1', 'We have reviewed important medical conditions with a clinician.'],
    ['p2', 'Regular medications and supplements have been reviewed for pregnancy planning.'],
    ['p3', 'Recommended vaccinations/preconception care have been considered.'],
    ['p4', 'Folic acid supplementation has been discussed for the person who may become pregnant.'],
    ['p5', 'Dental and general health concerns are being addressed where appropriate.'],
  ]},
  { key: 'nutrition', label: 'Nutrition', items: [
    ['n1', 'Most meals contain vegetables/fruits and minimally processed foods.'],
    ['n2', 'We include adequate protein from suitable sources.'],
    ['n3', 'We regularly include whole grains, pulses/legumes, nuts or seeds as appropriate.'],
    ['n4', 'We limit frequent ultra-processed foods and sugary drinks.'],
    ['n5', "We avoid unregulated 'fertility boosters' or supplements without medical advice."],
  ]},
  { key: 'weight_metabolic', label: 'Weight & Metabolic Health', items: [
    ['w1', 'We know whether our current weight is appropriate for our health goals.'],
    ['w2', 'We are working toward a healthy, sustainable weight if advised.'],
    ['w3', 'Diabetes, thyroid disease or other relevant metabolic issues are appropriately managed.'],
    ['w4', 'We are avoiding crash diets and extreme weight-loss programs.'],
  ]},
  { key: 'movement_fitness', label: 'Movement & Fitness', items: [
    ['m1', 'We are physically active on most days of the week.'],
    ['m2', 'We include appropriate aerobic activity and/or strength work.'],
    ['m3', 'We break up long periods of sitting.'],
    ['m4', 'Our exercise plan is realistic and sustainable.'],
  ]},
  { key: 'sleep_recovery', label: 'Sleep & Recovery', items: [
    ['s1', 'We usually get adequate sleep.'],
    ['s2', 'Our sleep/wake timing is reasonably consistent.'],
    ['s3', 'We address persistent snoring, severe daytime sleepiness or other sleep concerns with a clinician.'],
    ['s4', "We protect some time for recovery rather than constantly operating in 'work mode'."],
  ]},
  { key: 'stress_relationship', label: 'Stress & Relationship', items: [
    ['st1', 'We have a healthy way to manage daily stress.'],
    ['st2', 'We make time for connection as a couple outside fertility planning.'],
    ['st3', 'We avoid blaming each other for difficulty conceiving.'],
    ['st4', 'Trying to conceive has not become the only focus of our relationship.'],
    ['st5', 'We know where to seek emotional support if the process becomes overwhelming.'],
  ]},
  { key: 'exposures', label: 'Tobacco, Alcohol & Other Exposures', items: [
    ['e1', 'Neither partner uses tobacco/nicotine, or a cessation plan is underway.'],
    ['e2', 'Alcohol intake is minimized/avoided appropriately while planning pregnancy.'],
    ['e3', 'Recreational drugs are avoided.'],
    ['e4', 'Occupational/environmental exposures relevant to reproductive health have been reviewed when applicable.'],
    ['e5', 'We discuss significant medication or supplement exposures with a clinician.'],
  ]},
  { key: 'male_fertility', label: 'Male Fertility Check', items: [
    ['mf1', 'We understand that male factors can contribute to infertility.'],
    ['mf2', 'Tobacco/nicotine exposure has been addressed.'],
    ['mf3', 'Weight, exercise, sleep and metabolic health are being optimized.'],
    ['mf4', 'Relevant medications, heat/occupational exposures or prior reproductive problems have been reviewed if applicable.'],
    ['mf5', 'Semen analysis is considered when clinically indicated rather than assuming the issue is female.'],
  ]},
  { key: 'female_fertility', label: 'Female Fertility Check', items: [
    ['ff1', 'Menstrual cycles are tracked for pattern and regularity.'],
    ['ff2', 'Irregular/absent periods have been discussed with a clinician.'],
    ['ff3', 'Severe period pain or symptoms suggestive of endometriosis have been discussed.'],
    ['ff4', 'Previous pelvic infection, surgery or known tubal problems have been considered.'],
    ['ff5', 'Age and reproductive timeline have been considered in planning.'],
  ]},
];

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

const fqState = {
  screen: 'form', // 'form' | 'success'
  contactOptIn: false,
  submitting: false,
  error: '',
  result: null,
};

function openFertilityQuestionnaire() {
  const overlay = document.getElementById('fqOverlay');
  if (!overlay) return;
  Object.assign(fqState, { screen: 'form', contactOptIn: false, submitting: false, error: '', result: null });
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

function fqToggleContact() {
  fqState.contactOptIn = document.getElementById('fqContactOptIn')?.checked || false;
  const box = document.getElementById('fqContactFields');
  if (box) box.style.display = fqState.contactOptIn ? 'block' : 'none';
}

function renderFqWidget() {
  const body = document.getElementById('fqBody');
  if (!body) return;
  body.innerHTML = fqState.screen === 'success' ? renderFqSuccess() : renderFqForm();
}

function fqSectionHTML(section) {
  return `
    <div class="fq-section">
      <h4>${escapeHTML(section.label)}</h4>
      ${section.items.map(([key, text]) => `
        <label class="fq-check-row">
          <input type="checkbox" name="${key}" id="fq_${key}">
          <span>${escapeHTML(text)}</span>
        </label>
      `).join('')}
    </div>`;
}

function renderFqForm() {
  return `
    <p class="fq-intro">Complete this together \u2014 there's no score and no diagnosis. It takes about 5 minutes and
      helps you see, at a glance, where things already look solid and where you might want to focus.</p>

    ${FQ_SECTIONS.map(fqSectionHTML).join('')}

    <div class="fq-section fq-redflags">
      <h4>When Should We Seek Help?</h4>
      <p class="fq-redflags-note">Lifestyle improvement should complement \u2014 not replace \u2014 appropriate fertility
        evaluation. Check anything that applies to you.</p>
      ${FQ_RED_FLAGS.map(([key, text]) => `
        <label class="fq-check-row">
          <input type="checkbox" name="${key}" id="fq_${key}">
          <span>${escapeHTML(text)}</span>
        </label>
      `).join('')}
    </div>

    <div class="fq-section">
      <h4>A Little About You <span class="fq-optional">(optional)</span></h4>
      <div class="fq-demo-row">
        <div class="bw-form-group" style="flex:1;">
          <label class="bw-form-label" for="fqAge1">Partner 1 Age</label>
          <input type="number" id="fqAge1" class="bw-form-input" min="16" max="60">
        </div>
        <div class="bw-form-group" style="flex:1;">
          <label class="bw-form-label" for="fqAge2">Partner 2 Age</label>
          <input type="number" id="fqAge2" class="bw-form-input" min="16" max="60">
        </div>
      </div>
      <div class="bw-form-group">
        <label class="bw-form-label" for="fqTrying">Trying for (months)</label>
        <input type="number" id="fqTrying" class="bw-form-input" min="0" max="240">
      </div>
    </div>

    <div class="fq-section">
      <label class="fq-check-row fq-contact-toggle">
        <input type="checkbox" id="fqContactOptIn" onchange="fqToggleContact()">
        <span><strong>We're comfortable being contacted</strong> by Dr. Puja's Clinic about our results.</span>
      </label>
      <div id="fqContactFields" style="display:none;">
        <div class="bw-form-group">
          <label class="bw-form-label" for="fqName">Name</label>
          <input type="text" id="fqName" class="bw-form-input">
        </div>
        <div class="bw-form-group">
          <label class="bw-form-label" for="fqPhone">Mobile Number</label>
          <input type="tel" id="fqPhone" class="bw-form-input" maxlength="10" inputmode="numeric" placeholder="10-digit mobile number">
        </div>
        <div class="bw-form-group">
          <label class="bw-form-label" for="fqEmail">Email</label>
          <input type="email" id="fqEmail" class="bw-form-input">
        </div>
        <p class="fq-privacy-note">Your responses are used only to give you this summary and, if you've opted in above,
          for the clinic to follow up. See our <a href="#privacy" onclick="closeFertilityQuestionnaire();showPage('privacy');return false;">Privacy Policy</a>.</p>
      </div>
    </div>

    <div class="fq-error" id="fqError" role="alert" aria-live="polite">${escapeHTML(fqState.error)}</div>
    <button class="bw-primary-btn" id="fqSubmitBtn" onclick="submitFertilityQuestionnaire()" ${fqState.submitting ? 'disabled' : ''}>
      ${fqState.submitting ? 'Submitting\u2026' : 'See My Summary'}
    </button>
  `;
}

function fqStatusLabel(status) {
  if (status === 'strong') return { text: 'Looking Strong', cls: 'fq-status-strong' };
  if (status === 'attention') return { text: 'Worth a Closer Look', cls: 'fq-status-attention' };
  return { text: 'Consider Focusing Here', cls: 'fq-status-focus' };
}

function renderFqSuccess() {
  const r = fqState.result;
  if (!r) return '<p class="fq-intro">Something went wrong showing your summary \u2014 please check your email or contact the clinic.</p>';

  const redFlagBanner = r.needs_follow_up ? `
    <div class="fq-followup-banner">
      <strong>Based on a few of your answers, we'd recommend booking a consultation sooner rather than later.</strong>
      <p>This isn't a diagnosis \u2014 just a signal that it's worth having a clinician take a look now, rather than waiting.</p>
      <button class="btn btn-primary btn-sm" onclick="closeFertilityQuestionnaire();openBooking();">Book a Consultation</button>
    </div>` : '';

  const sections = r.section_summary.map(s => {
    const st = fqStatusLabel(s.status);
    return `
      <div class="fq-result-row">
        <div class="fq-result-head">
          <span>${escapeHTML(s.label)}</span>
          <span class="fq-status-pill ${st.cls}">${st.text}</span>
        </div>
        <p>${escapeHTML(s.tip)}</p>
      </div>`;
  }).join('');

  return `
    <div class="fq-success-wrap">
      <div class="fq-success-tick" aria-hidden="true">\u2705</div>
      <h3>Thank You \u2014 Here's Your Summary</h3>
      <p class="fq-intro">This is a self-check, not a test result. Use it as a starting point for your own conversation
        \u2014 and with Dr. Puja, whenever you're ready.</p>
      ${redFlagBanner}
      ${sections}
      <button class="bw-done-btn" style="width:100%;margin-top:16px;" onclick="closeFertilityQuestionnaire()">Done</button>
    </div>
  `;
}

async function submitFertilityQuestionnaire() {
  const responses = {};
  FQ_SECTIONS.forEach(sec => sec.items.forEach(([key]) => {
    responses[key] = !!document.getElementById(`fq_${key}`)?.checked;
  }));
  FQ_RED_FLAGS.forEach(([key]) => {
    responses[key] = !!document.getElementById(`fq_${key}`)?.checked;
  });

  const contactOptIn = document.getElementById('fqContactOptIn')?.checked || false;
  const name = document.getElementById('fqName')?.value.trim() || '';
  const phone = document.getElementById('fqPhone')?.value.trim() || '';
  const email = document.getElementById('fqEmail')?.value.trim() || '';

  if (contactOptIn && !phone && !email) {
    fqState.error = 'Please provide a phone number or email so we can follow up.';
    renderFqWidget();
    return;
  }

  fqState.submitting = true;
  fqState.error = '';
  renderFqWidget();

  const res = await bwApi('/submit-fertility-questionnaire.php', {
    method: 'POST',
    body: {
      responses,
      contact_opt_in: contactOptIn,
      name: name || null,
      phone: phone || null,
      email: email || null,
      partner1_age: document.getElementById('fqAge1')?.value || null,
      partner2_age: document.getElementById('fqAge2')?.value || null,
      trying_since_months: document.getElementById('fqTrying')?.value || null,
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
