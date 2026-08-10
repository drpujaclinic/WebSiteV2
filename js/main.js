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
    const titles = {
      home: "Dr. Puja's Clinic | Best Gynaecologist in Patparganj, East Delhi",
      about: "About Dr. Puja Prasad | Senior Gynaecologist, Patparganj",
      services: "Services | Dr. Puja's Clinic, Patparganj",
      facilities: "Facilities | Dr. Puja's Clinic, Patparganj",
      locations: "Locations & Timings | Dr. Puja's Clinic",
      testimonials: "Patient Stories | Dr. Puja's Clinic",
      blog: "Women's Health Blog | Dr. Puja Prasad",
      contact: "Contact Us | Dr. Puja's Clinic, Patparganj",
      "fertility-community": "Fertility Education Community | Dr. Puja's Clinic",
    };
    if (titles[name]) document.title = titles[name];
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'blog' && typeof blogInit === 'function') blogInit();
     if ((name === 'locations' || name === 'contact') && typeof initClinicMaps === 'function') initClinicMaps();
  }
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
  });
  const navEl = document.getElementById('nav-' + name);
  if (navEl) {
    navEl.classList.add('active');
    navEl.setAttribute('aria-current', 'page');
  }
  // Close mobile menu if open
  closeMobileMenu();
  // Push to browser history for deep-linking
  if (history.pushState) {
    history.pushState({ page: name }, '', '#' + name);
  }
}

// ADD after the existing showPage() function:

function showBlogArticle(slug, pushHistory = true) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-blog-article');
  if (!target) return;
  target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
  });
  document.getElementById('nav-blog')?.classList.add('active'); // article is conceptually under Blog

  closeMobileMenu();

  if (pushHistory && history.pushState) {
    history.pushState({ page: 'blog-article', slug }, '', '#blog/' + encodeURIComponent(slug));
  }

  if (typeof blogLoadArticleDetail === 'function') blogLoadArticleDetail(slug);
}

// Restore page from URL hash on load (enables direct links & browser back/forward)
// REPLACE restorePageFromHash() entirely with:

function restorePageFromHash() {
  const hash = location.hash.replace('#', '').trim();

  if (hash.startsWith('blog/')) {
    const slug = decodeURIComponent(hash.slice(5));
    if (slug) { showBlogArticle(slug, false); return; }
  }

  const validPages = ['home', 'about', 'services', 'facilities', 'locations', 'blog',
    'contact', 'testimonials', 'privacy', 'disclaimer', 'terms', 'fertility-community'];
  if (hash && validPages.includes(hash)) {
    showPage(hash);
  }
}

// REPLACE the popstate listener entirely with:

window.addEventListener('popstate', function (e) {
  if (e.state && e.state.page === 'blog-article' && e.state.slug) {
    showBlogArticle(e.state.slug, false);
    return;
  }
  if (e.state && e.state.page) {
    showPage(e.state.page);
  }
});

// ── MOBILE MENU ──────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
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
  const btn = document.getElementById('hamburgerBtn');
  if (menu) menu.classList.remove('open');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

// Close mobile menu on outside click
document.addEventListener('click', function (e) {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (menu && menu.classList.contains('open') &&
    !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    closeMobileMenu();
  }
});

// Escape key closes the mobile menu or chat panel, whichever is open
// (WCAG 2.2 AA — keyboard users need a way to dismiss overlays without a mouse)
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  const menu = document.getElementById('mobileMenu');
  if (menu && menu.classList.contains('open')) {
    closeMobileMenu();
    return;
  }
  const chat = document.getElementById('chatPanel');
  if (chat && chat.classList.contains('open')) {
    closeChat();
  }
});


// ── STICKY NAV ───────────────────────────────────────────────────────────────
window.addEventListener('scroll', function () {
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
document.addEventListener('DOMContentLoaded', function () {
  restorePageFromHash();
  // Initial nav state push
  const currentHash = location.hash.replace('#', '').trim();
  if (!currentHash) {
    history.replaceState({ page: 'home' }, '', '#home');
  }
});
