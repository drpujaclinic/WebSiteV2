/**
 * DR. PUJA'S CLINIC — blog.js
 * Dynamic Blog listing (featured + paginated grid + category filter) and
 * article detail rendering. Depends on: booking.js (bwApi, escapeHTML,
 * showNotification, openBooking), main.js (showBlogArticle — routing lives
 * there, not here), chat.js (openChat).
 *
 * Every function/signature that existed before this revision is unchanged
 * — main.js and index.html call several of these directly by name
 * (blogInit, blogLoadMore, blogFilterByCategory, blogClearFilter,
 * blogLoadArticleDetail). New capability is additive only.
 */
'use strict';

const blogState = {
  category: null,     // active category slug, or null = all
  page: 1,
  pageSize: 9,
  totalPages: 0,
  loading: false,
  initialized: false,
};

// ── LISTING: article card + featured slot ──────────────────────────────────
function blogArticleCardHTML(a) {
  const reviewedLabel = a.last_medical_review_at
    ? new Date(a.last_medical_review_at + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const metaParts = [
    escapeHTML(a.author.name),
    a.read_minutes ? `${a.read_minutes} min read` : null,
    reviewedLabel ? `Reviewed ${reviewedLabel}` : null,
  ].filter(Boolean);

  return `
    <article class="blog-card" onclick="showBlogArticle('${a.slug}');return false;" role="button" tabindex="0" aria-label="${escapeHTML(a.title)}">
      <div class="blog-thumb" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <div class="blog-body">
        <div class="blog-tag">${escapeHTML(a.category.name)}</div>
        <h3>${escapeHTML(a.title)}</h3>
        <p>${escapeHTML(a.summary)}</p>
        <div class="blog-meta">${metaParts.join(' · ')}</div>
      </div>
    </article>`;
}

async function blogLoadFeatured() {
  const container = document.getElementById('blogFeaturedContainer');
  if (!container) return;

  try {
    const res = await bwApi('/blog/articles?featured=1&page_size=1');
    if (!res || !res.success || !Array.isArray(res.articles) || res.articles.length === 0) {
      container.closest('.section-header')?.style.setProperty('display', 'none');
      container.style.display = 'none';
      return;
    }

    const a = res.articles[0];
    container.innerHTML = `
      <div class="featured-article-thumb" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
      <div class="featured-article-body" onclick="showBlogArticle('${a.slug}');return false;" role="button" tabindex="0" style="cursor:pointer;">
        <div class="blog-tag">${escapeHTML(a.category.name)}</div>
        <h3>${escapeHTML(a.title)}</h3>
        <p>${escapeHTML(a.summary)}</p>
        <div class="blog-meta">${escapeHTML(a.author.name)}${a.read_minutes ? ' · ' + a.read_minutes + ' min read' : ''}</div>
      </div>`;
  } catch (err) {
    container.style.display = 'none'; // fail closed — never leave a half-rendered featured slot
  }
}

async function blogLoadCategoryCounts() {
  try {
    const res = await bwApi('/blog/categories');
    if (!res || !res.success || !Array.isArray(res.categories)) return;
    res.categories.forEach(c => {
      const card = document.querySelector(`.blog-category-card[data-category-slug="${c.slug}"]`);
      const badge = card?.querySelector('.blog-category-count-badge');
      if (badge) {
        badge.textContent = `${c.article_count} article${c.article_count === 1 ? '' : 's'}`;
      }
    });
  } catch (err) {
    // Supplementary, non-critical UI — fail silently, badges just stay empty
    // rather than showing an error message for something this minor.
  }
}

// ── LISTING: pagination ─────────────────────────────────────────────────────
async function blogLoadArticles(append = false) {
  if (blogState.loading) return;
  blogState.loading = true;

  const grid = document.getElementById('blogArticlesGrid');
  const loadMoreBtn = document.getElementById('blogLoadMoreBtn');
  if (!append && grid) grid.innerHTML = `<p class="blog-loading">Loading articles…</p>`;
  if (loadMoreBtn) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Loading…'; }

  try {
    const params = new URLSearchParams({ page: String(blogState.page), page_size: String(blogState.pageSize) });
    if (blogState.category) params.set('category', blogState.category);

    const res = await bwApi(`/blog/articles?${params.toString()}`);

    if (!res || !res.success || !Array.isArray(res.articles)) {
      if (grid) grid.innerHTML = `<p class="blog-load-error">Could not load articles right now. Please try again shortly.</p>`;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const pagination = res.pagination || {};
    blogState.totalPages = Number(pagination.total_pages) || 0;

    if (grid) {
      if (res.articles.length === 0) {
        if (!append) {
          grid.innerHTML = `<p class="blog-no-articles">No articles ${blogState.category ? 'in this category ' : ''}yet — check back soon.</p>`;
        }
      } else {
        const html = res.articles.map(blogArticleCardHTML).join('');
        if (append) grid.insertAdjacentHTML('beforeend', html);
        else grid.innerHTML = html;
      }
    }

    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More Articles';
      loadMoreBtn.style.display = blogState.page < blogState.totalPages ? 'block' : 'none';
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<p class="blog-load-error">Something went wrong loading articles. Please try again shortly.</p>`;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  } finally {
    blogState.loading = false;
  }
}

function blogLoadMore() {
  blogState.page += 1;
  blogLoadArticles(true);
}

function blogFilterByCategory(slug, name) {
  if (!slug) return;
  blogState.category = blogState.category === slug ? null : slug;
  blogState.page = 1;
  blogRenderActiveFilterBadge(name);
  blogLoadArticles();
  document.getElementById('blogArticlesGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function blogClearFilter() {
  blogState.category = null;
  blogState.page = 1;
  blogRenderActiveFilterBadge();
  blogLoadArticles();
}

function blogRenderActiveFilterBadge(name) {
  const el = document.getElementById('blogActiveFilter');
  if (!el) return;
  if (!blogState.category) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span class="blog-filter-badge">
      Showing: ${escapeHTML(name || blogState.category)}
      <button onclick="blogClearFilter()" aria-label="Clear category filter">✕</button>
    </span>`;
}

document.addEventListener('click', function (e) {
  const btn = e.target.closest('.blog-category-filter-btn');
  if (!btn) return;
  e.preventDefault();
  blogFilterByCategory(btn.dataset.categorySlug, btn.dataset.categoryName);
});

function blogInit() {
  if (!document.getElementById('page-blog')) return;
  blogState.category = null;
  blogState.page = 1;
  blogRenderActiveFilterBadge();
  blogLoadFeatured();
  blogLoadArticles();
  blogLoadCategoryCounts();
  blogState.initialized = true;
}

// ── ARTICLE DETAIL: content blocks ──────────────────────────────────────────
// Internal-only link targets a "link" block may point to — mirrors the
// backend's blogValidateLinkHref() allowlist exactly (see
// backend/api/staff/blog-article-upsert.php). Any href a CMS author saved
// already passed that same allowlist server-side; this is a defensive
// second check on the render side, not the primary control.
function blogIsSafeInternalHref(href) {
  const fixed = ['#home', '#about', '#services', '#facilities', '#locations', '#blog', '#testimonials', '#contact', '#fertility-community'];
  if (fixed.includes(href)) return true;
  if (/^#blog\/[a-z0-9]+(-[a-z0-9]+)*$/.test(href)) return true;
  if (/^tel:\+?[0-9]{7,15}$/.test(href)) return true;
  if (/^files\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*\.pdf$/.test(href)) return true;
  return false;
}

function blogLinkClickHandler(href) {
  if (href.startsWith('#blog/')) {
    const slug = decodeURIComponent(href.slice(6));
    return `showBlogArticle('${slug}');return false;`;
  }
  if (href.startsWith('#') && href !== '#blog') {
    return `showPage('${href.slice(1)}');return false;`;
  }
  if (href === '#blog') {
    return `showPage('blog');return false;`;
  }
  return ''; // tel: / files/*.pdf — let the browser handle it natively
}

// Slugifies heading text into a stable, readable anchor id. Collisions
// (two headings with identical text) get a numeric suffix so ids stay
// unique within the article.
function blogSlugifyHeading(text, usedSlugs) {
  let base = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  let slug = base;
  let n = 2;
  while (usedSlugs.has(slug)) { slug = `${base}-${n}`; n++; }
  usedSlugs.add(slug);
  return slug;
}

/**
 * Renders one content block. Adds `link` and checklist-flagged `list`
 * rendering, and a third callout tone ("action"), on top of the original
 * heading/paragraph/list/image/quote/callout set. `headingSlugs` is an
 * optional Set (heading blocks only) used to attach a stable anchor id for
 * the "In This Article" TOC — omit it (as the old call sites do) and
 * headings render exactly as before, with no id attribute.
 */
function blogRenderBlock(block, headingSlugs) {
  if (!block || !block.type) return '';
  const text = escapeHTML(block.text || '');
  switch (block.type) {
    case 'heading': {
      const idAttr = headingSlugs ? ` id="${blogSlugifyHeading(block.text || '', headingSlugs)}"` : '';
      return `<h2${idAttr}>${text}</h2>`;
    }
    case 'paragraph':
      return `<p>${text}</p>`;
    case 'list': {
      const tag = block.style === 'ordered' ? 'ol' : 'ul';
      const items = Array.isArray(block.items) ? block.items : [];
      if (block.checklist) {
        const groupId = 'chk' + Math.random().toString(36).slice(2, 9);
        return `<ul class="blog-checklist" role="list">${items.map((item, i) => {
          const cbId = `${groupId}-${i}`;
          return `<li class="blog-checklist-item">
            <input type="checkbox" id="${cbId}" class="blog-checklist-checkbox">
            <label for="${cbId}">${escapeHTML(item)}</label>
          </li>`;
        }).join('')}</ul>`;
      }
      return `<${tag} class="blog-content-list">${items.map(i => `<li>${escapeHTML(i)}</li>`).join('')}</${tag}>`;
    }
    case 'image': {
      if (!block.src) return '';
      const src = `images/blog/${block.src}`.replace(/\/{2,}/g, '/');
      const alt = escapeHTML(block.alt || '');
      const caption = block.caption ? `<figcaption>${escapeHTML(block.caption)}</figcaption>` : '';
      return `<figure class="blog-content-image"><img src="${src}" alt="${alt}" loading="lazy" decoding="async">${caption}</figure>`;
    }
    case 'quote': {
      const attribution = block.attribution ? `<cite>${escapeHTML(block.attribution)}</cite>` : '';
      return `<blockquote class="blog-content-quote"><p>${text}</p>${attribution}</blockquote>`;
    }
    case 'callout': {
      const tone = ['warning', 'action'].includes(block.tone) ? block.tone : 'info';
      const icon = tone === 'warning' ? '⚠️' : tone === 'action' ? '✅' : 'ℹ️';
      return `<div class="blog-content-callout blog-content-callout-${tone}"><span class="blog-callout-icon" aria-hidden="true">${icon}</span><div>${text}</div></div>`;
    }
    case 'link': {
      if (!block.href || !blogIsSafeInternalHref(block.href)) return '';
      const label = escapeHTML(block.label || block.href);
      const onclick = blogLinkClickHandler(block.href);
      const hrefAttr = block.href.startsWith('#') && !onclick.includes('showBlogArticle') && !onclick.includes('showPage') ? block.href : (block.href.startsWith('tel:') || block.href.endsWith('.pdf') ? block.href : '#');
      const extra = block.href.endsWith('.pdf') ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<p class="blog-content-link"><a href="${escapeHTML(block.href)}" ${onclick ? `onclick="${onclick}"` : ''}${extra}>${label} <span aria-hidden="true">→</span></a></p>`;
    }
    default:
      return '';
  }
}

// ── ARTICLE DETAIL: "In This Article" TOC ───────────────────────────────────
function blogBuildTOC(contentBlocks) {
  const usedSlugs = new Set();
  const entries = [];
  contentBlocks.forEach(b => {
    if (b.type === 'heading' && b.text) {
      entries.push({ text: b.text, slug: blogSlugifyHeading(b.text, usedSlugs) });
    }
  });
  return entries;
}

function blogRenderTOC(entries) {
  if (entries.length < 3) return ''; // not worth a TOC for a short article
  const items = entries.map(e => `<li><a href="#${e.slug}" onclick="blogScrollToHeading(event,'${e.slug}')">${escapeHTML(e.text)}</a></li>`).join('');
  return `
    <nav class="blog-toc" aria-label="Article sections">
      <details open>
        <summary>In This Article</summary>
        <ol>${items}</ol>
      </details>
    </nav>`;
}

function blogScrollToHeading(e, slug) {
  e.preventDefault();
  const el = document.getElementById(slug);
  if (!el) return;
  const navHeight = 86; // clears the fixed site nav
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
  window.scrollTo({ top, behavior: 'smooth' });
  history.replaceState(null, '', '#blog/' + (window.__blogCurrentSlug || '') + '#' + slug === '' ? '' : location.hash.split('#').slice(0, 2).join('#'));
}

// ── ARTICLE DETAIL: share bar ────────────────────────────────────────────
function blogCanonicalUrl(article) {
  if (article.seo && article.seo.canonical_url) {
    return article.seo.canonical_url.startsWith('http')
      ? article.seo.canonical_url
      : 'https://drpujaprasad.in' + (article.seo.canonical_url.startsWith('/') ? '' : '/') + article.seo.canonical_url;
  }
  return `https://drpujaprasad.in/#blog/${encodeURIComponent(article.slug)}`;
}

function blogRenderShareBar(article) {
  const url = blogCanonicalUrl(article);
  const title = article.title;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return `
    <div class="blog-share-bar" aria-label="Share this article">
      <span class="blog-share-label">Share</span>
      <a href="https://wa.me/?text=${encodedTitle}%20${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" class="blog-share-btn blog-share-wa">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487 2.981 1.287 2.981.858 3.52.804.538-.054 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" class="blog-share-btn">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>
      </a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" class="blog-share-btn">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>
      </a>
      <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="Share on X" class="blog-share-btn">
        <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20z"/></svg>
      </a>
      <button type="button" onclick="blogCopyLink('${escapeHTML(url).replace(/'/g, "\\'")}')" aria-label="Copy link" class="blog-share-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>
      </button>
      <button type="button" onclick="blogNativeShare('${escapeHTML(url).replace(/'/g, "\\'")}','${escapeHTML(title).replace(/'/g, "\\'")}')" class="blog-share-btn blog-share-native" aria-label="Share via device">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>
      </button>
    </div>`;
}

function blogCopyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    if (typeof showNotification === 'function') showNotification('Link Copied', 'The article link has been copied to your clipboard.');
  }).catch(() => {
    if (typeof showNotification === 'function') showNotification('Could Not Copy', 'Please copy the link from your browser address bar.');
  });
}

function blogNativeShare(url, title) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    blogCopyLink(url);
  }
}

// ── ARTICLE DETAIL: contextual CTAs ─────────────────────────────────────────
function blogRenderEvaluationCTA() {
  return `
    <div class="blog-inline-cta">
      <p>If any of this sounds familiar, it may be worth having it looked at directly.</p>
      <button class="btn btn-primary btn-sm" onclick="openBooking()">📅 Book a Fertility Evaluation</button>
    </div>`;
}

function blogRenderNextStepsCard() {
  return `
    <div class="blog-next-steps">
      <h3>Next Steps</h3>
      <div class="blog-next-steps-grid">
        <button onclick="openChat()" class="blog-next-step-btn">
          <span aria-hidden="true">💬</span>
          <span>Ask the AI Assistant</span>
        </button>
        <button onclick="openBooking()" class="blog-next-step-btn">
          <span aria-hidden="true">📅</span>
          <span>Book Appointment</span>
        </button>
        <button onclick="showPage('fertility-community')" class="blog-next-step-btn">
          <span aria-hidden="true">👥</span>
          <span>Join Fertility Community</span>
        </button>
      </div>
    </div>`;
}

// ── ARTICLE DETAIL: "Was this helpful?" feedback ────────────────────────────
function blogRenderFeedbackWidget(articleId) {
  return `
    <div class="blog-feedback" id="blogFeedback" data-article-id="${articleId}" data-submitted="0">
      <div id="blogFeedbackQuestion">
        <p>Was this article helpful?</p>
        <div class="blog-feedback-actions">
          <button onclick="blogSubmitFeedback('yes')" class="btn btn-outline btn-sm">Yes</button>
          <button onclick="blogSubmitFeedback('not_sure')" class="btn btn-outline btn-sm">Not sure</button>
        </div>
      </div>
      <div id="blogFeedbackThanks" style="display:none;">
        <p>Thank you — that helps us improve this resource.</p>
        <div id="blogFeedbackSuggestBox">
          <label for="blogFeedbackSuggestion" style="display:block;font-size:12px;color:var(--ink-light);margin-bottom:6px;">Anything you'd like us to explain next? <span style="color:var(--ink-faint);">(optional, anonymous)</span></label>
          <textarea id="blogFeedbackSuggestion" rows="2" maxlength="500" style="width:100%;font-size:13px;border:1.5px solid var(--ivory-dark);border-radius:8px;padding:8px 10px;"></textarea>
          <button onclick="blogSubmitFeedbackSuggestion()" class="btn btn-outline btn-sm" style="margin-top:8px;">Send</button>
        </div>
      </div>
    </div>`;
}

async function blogSubmitFeedback(helpful) {
  const wrap = document.getElementById('blogFeedback');
  if (!wrap || wrap.dataset.submitted === '1') return;
  wrap.dataset.submitted = '1';
  document.getElementById('blogFeedbackQuestion').style.display = 'none';
  document.getElementById('blogFeedbackThanks').style.display = 'block';

  const articleId = parseInt(wrap.dataset.articleId, 10);
  try {
    await fetch('/api/submit-blog-feedback.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ article_id: articleId, helpful }),
    });
  } catch (err) { /* best-effort — the reader has already seen their thanks message */ }
}

async function blogSubmitFeedbackSuggestion() {
  const wrap = document.getElementById('blogFeedback');
  const box = document.getElementById('blogFeedbackSuggestBox');
  const textarea = document.getElementById('blogFeedbackSuggestion');
  const suggestion = textarea.value.trim();
  if (!suggestion) { box.style.display = 'none'; return; }

  const articleId = parseInt(wrap.dataset.articleId, 10);
  try {
    await fetch('/api/submit-blog-feedback.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ article_id: articleId, helpful: 'yes', suggestion }),
    });
  } catch (err) { /* best-effort */ }
  box.innerHTML = '<p style="font-size:12px;color:var(--ink-light);">Thanks — we read every suggestion.</p>';
}

// ── ARTICLE DETAIL: structured data ─────────────────────────────────────────
function blogInjectStructuredData(article) {
  document.getElementById('blogArticleJsonLd')?.remove();

  const url = blogCanonicalUrl(article);
  const graph = [{
    '@type': 'MedicalWebPage',
    '@id': url + '#webpage',
    url,
    name: article.title,
    description: (article.seo && article.seo.meta_description) || article.summary,
    lastReviewed: article.last_medical_review_at || undefined,
    datePublished: article.published_at || undefined,
    author: { '@type': 'Person', name: article.author.name, honorificSuffix: article.author.credentials || undefined },
    reviewedBy: article.reviewer ? { '@type': 'Person', name: article.reviewer.name, honorificSuffix: article.reviewer.credentials || undefined } : undefined,
    publisher: { '@type': 'MedicalOrganization', name: "Dr. Puja's Clinic", url: 'https://drpujaprasad.in' },
  }];

  if (Array.isArray(article.faqs) && article.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: article.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: (f.answer || []).filter(b => b.type === 'paragraph' || b.type === 'heading').map(b => b.text).join(' '),
        },
      })),
    });
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'blogArticleJsonLd';
  // JSON.stringify already drops `undefined` values, so optional fields
  // above (lastReviewed, reviewedBy, etc.) simply vanish rather than
  // emitting the literal string "undefined" into the graph.
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  document.head.appendChild(script);
}

// ── ARTICLE DETAIL: main render ─────────────────────────────────────────────
async function blogLoadArticleDetail(slug) {
  const body            = document.getElementById('blogArticleBody');
  const heroTitle        = document.getElementById('blogArticleHeroTitle');
  const heroMeta          = document.getElementById('blogArticleHeroMeta');
  const breadcrumbTitle  = document.getElementById('blogArticleBreadcrumbTitle');
  if (!body) return;

  body.innerHTML = `<p class="blog-loading">Loading article…</p>`;
  if (heroTitle) heroTitle.innerHTML = `<em>Loading…</em>`;
  if (heroMeta) heroMeta.textContent = '';
  if (breadcrumbTitle) breadcrumbTitle.textContent = '…';
  document.getElementById('blogArticleJsonLd')?.remove();

  try {
    const res = await bwApi(`/blog/articles/${encodeURIComponent(slug)}`);

    if (!res || !res.success || !res.article) {
      body.innerHTML = `
        <p class="blog-load-error">This article couldn't be found. It may have been moved or unpublished.</p>
        <p style="margin-top:16px;"><a href="#blog" onclick="showPage('blog');return false;" class="btn btn-outline">← Back to Blog</a></p>`;
      if (heroTitle) heroTitle.textContent = 'Article Not Found';
      if (heroMeta) heroMeta.textContent = '';
      if (breadcrumbTitle) breadcrumbTitle.textContent = 'Not Found';
      document.title = "Article Not Found | Dr. Puja's Clinic";
      return;
    }

    const a = res.article;
    window.__blogCurrentSlug = a.slug;

    if (heroTitle) heroTitle.innerHTML = escapeHTML(a.title);
    const reviewedLabel = a.last_medical_review_at
      ? new Date(a.last_medical_review_at + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    const heroMetaParts = [
      `By ${a.author.name}${a.author.credentials ? ' (' + a.author.credentials + ')' : ''}`,
      a.reviewer ? `Reviewed by ${a.reviewer.name}` : null,
      reviewedLabel ? `Last medically reviewed: ${reviewedLabel}` : null,
      a.read_minutes ? `${a.read_minutes} min read` : null,
    ].filter(Boolean);
    if (heroMeta) heroMeta.textContent = heroMetaParts.join(' · ');
    if (breadcrumbTitle) breadcrumbTitle.textContent = a.title;
    document.title = `${a.title} | Dr. Puja's Clinic`;

    const metaDescEl = document.querySelector('meta[name="description"]');
    if (metaDescEl) metaDescEl.setAttribute('content', (a.seo && a.seo.meta_description) || a.summary);

    const contentBlocks = a.content || [];
    const headingSlugs = new Set();
    const contentHTML = contentBlocks.map(b => blogRenderBlock(b, headingSlugs)).join('');
    const toc = blogRenderTOC(blogBuildTOC(contentBlocks));
    const hasChecklist = contentBlocks.some(b => b.type === 'list' && b.checklist);
    const hasWarningCallout = contentBlocks.some(b => b.type === 'callout' && b.tone === 'warning');

    const checklistCTA = hasChecklist ? `
      <div class="blog-checklist-cta">
        <a href="files/couple-fertility-checklist.pdf" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">📋 Download Printable Checklist (PDF)</a>
      </div>` : '';

    const evaluationCTA = hasWarningCallout ? blogRenderEvaluationCTA() : '';

    const faqHTML = (a.faqs && a.faqs.length) ? `
      <h2 style="margin-top:48px;">Frequently Asked Questions</h2>
      <div class="blog-faq-list">
        ${a.faqs.map(f => `
          <details class="blog-faq-item">
            <summary>${escapeHTML(f.question)}</summary>
            <div>${(f.answer || []).map(b => blogRenderBlock(b)).join('')}</div>
          </details>`).join('')}
      </div>` : '';

    let relatedHTML = '';
    if (a.is_pillar && a.cluster_articles && a.cluster_articles.length) {
      relatedHTML = `
        <h2 style="margin-top:48px;">In This Series</h2>
        <ul class="blog-related-list">
          ${a.cluster_articles.map(c =>
            `<li><a href="#blog/${encodeURIComponent(c.slug)}" onclick="showBlogArticle('${c.slug}');return false;">${escapeHTML(c.title)}</a></li>`
          ).join('')}
        </ul>`;
    } else if (a.pillar_article) {
      relatedHTML = `
        <p class="blog-pillar-backlink">
          Part of our guide:
          <a href="#blog/${encodeURIComponent(a.pillar_article.slug)}" onclick="showBlogArticle('${a.pillar_article.slug}');return false;">${escapeHTML(a.pillar_article.title)}</a>
        </p>`;
    }

    body.innerHTML = `
      <div class="blog-tag">${escapeHTML(a.category.name)}</div>
      ${blogRenderShareBar(a)}
      ${toc}
      <div class="blog-article-content">${contentHTML}</div>
      ${checklistCTA}
      ${evaluationCTA}
      ${relatedHTML}
      ${faqHTML}
      ${blogRenderFeedbackWidget(a.id)}
      ${blogRenderNextStepsCard()}
    `;

    blogInjectStructuredData(a);
  } catch (err) {
    body.innerHTML = `<p class="blog-load-error">Something went wrong loading this article. Please try again shortly.</p>`;
    if (heroTitle) heroTitle.textContent = 'Error';
    if (breadcrumbTitle) breadcrumbTitle.textContent = 'Error';
  }
}
