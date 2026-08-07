/**
 * DR. PUJA'S CLINIC — consent.js
 * DPDP Act 2023 cookie consent banner + Google Consent Mode v2 update handlers.
 * The consent DEFAULT (denied) and the read of any prior stored choice happen
 * in index.html's <head> GA4 script, before this file loads — this file only
 * handles the banner UI and the 'consent update' calls once the user chooses.
 * No external dependencies. CSP-friendly (no inline event handlers needed
 * beyond the existing onclick="" convention already used site-wide).
 */
'use strict';

const CONSENT_STORAGE_KEY = 'dpc_cookie_consent'; // 'accepted' | 'declined'

function dpcGetStoredConsent() {
  try { return localStorage.getItem(CONSENT_STORAGE_KEY); } catch (e) { return null; }
}

function dpcSetStoredConsent(value) {
  try { localStorage.setItem(CONSENT_STORAGE_KEY, value); } catch (e) { /* ignore — private browsing etc. */ }
}

function dpcShowBanner() {
  const banner = document.getElementById('cookieConsentBanner');
  if (!banner) return;
  banner.hidden = false;
  document.body.classList.add('dpc-consent-visible'); // shifts FABs up so nothing overlaps
}

function dpcHideBanner() {
  const banner = document.getElementById('cookieConsentBanner');
  if (!banner) return;
  banner.hidden = true;
  document.body.classList.remove('dpc-consent-visible');
}

function dpcAcceptCookies() {
  dpcSetStoredConsent('accepted');
  if (typeof gtag === 'function') {
    gtag('consent', 'update', { 'analytics_storage': 'granted' });
  }
  dpcHideBanner();
}

function dpcDeclineCookies() {
  dpcSetStoredConsent('declined');
  if (typeof gtag === 'function') {
    gtag('consent', 'update', { 'analytics_storage': 'denied' });
  }
  dpcHideBanner();
}

document.addEventListener('DOMContentLoaded', () => {
  // Only show the banner if the visitor hasn't made a choice yet. If they
  // have, the <head> script already set the correct default from storage —
  // nothing further to do here.
  if (dpcGetStoredConsent() === null) {
    dpcShowBanner();
  }
});
