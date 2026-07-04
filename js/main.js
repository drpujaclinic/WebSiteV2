/**
 * DR. PUJA'S CLINIC — main.js
 * Page navigation, mobile menu, sticky nav, modal helpers, chat opener.
 * Loaded as the last <script> in index.html (after booking.js and chat.js).
 */

'use strict';

// ── PAGE NAVIGATION ──────────────────────────────────────────────────────────
// Supports hash routing so each section has a deep-linkable URL (#about, #services…)

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  // Close mobile menu if open
  closeMobileMenu();
  // Push to browser history for deep-linking
  if (history.pushState) {
    history.pushState({ page: name }, '', '#' + name);
  }
}

// Restore page from URL hash on load (enables direct links & browser back/forward)
function restorePageFromHash() {
  const hash = location.hash.replace('#', '').trim();
  const validPages = ['home','about','services','facilities','locations','blog',
                      'contact','testimonials','privacy','disclaimer','terms'];
  if (hash && validPages.includes(hash)) {
    showPage(hash);
  }
}

window.addEventListener('popstate', function(e) {
  if (e.state && e.state.page) {
    showPage(e.state.page);
  }
});

// ── MOBILE MENU ──────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.getElementById('hamburgerBtn');
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.getElementById('hamburgerBtn');
  if (menu) menu.classList.remove('open');
  if (btn)  { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

// Close mobile menu on outside click
document.addEventListener('click', function(e) {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.getElementById('hamburgerBtn');
  if (menu && menu.classList.contains('open') &&
      !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    closeMobileMenu();
  }
});

// ── STICKY NAV ───────────────────────────────────────────────────────────────
window.addEventListener('scroll', function() {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── BOOKING MODAL OUTSIDE CLICK ──────────────────────────────────────────────
function closeBookingOutside(e) {
  if (e.target === document.getElementById('bookingOverlay')) closeBooking();
}

// ── OPEN CHAT ────────────────────────────────────────────────────────────────
function openChat() {
  const panel = document.getElementById('chatPanel');
  if (panel && !panel.classList.contains('open')) toggleChat();
}

// ── INIT ON DOM READY ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  restorePageFromHash();
  // Initial nav state push
  const currentHash = location.hash.replace('#', '').trim();
  if (!currentHash) {
    history.replaceState({ page: 'home' }, '', '#home');
  }
});
