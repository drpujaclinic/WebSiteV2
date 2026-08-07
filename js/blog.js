/**
 * DR. PUJA'S CLINIC — blog.js
 * Dynamic Blog listing (featured + paginated grid + category filter) and
 * article detail rendering. Depends on: booking.js (bwApi, escapeHTML),
 * main.js (showBlogArticle — routing lives there, not here).
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

// ADD this new function:
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

    // Any unexpected response shape falls through to the error state below —
    // never leave the "Loading…" placeholder as a possible end state.
    if (!res || !res.success || !Array.isArray(res.articles)) {
      if (grid) grid.innerHTML = `<p class="blog-load-error">Could not load articles right now. Please try again shortly.</p>`;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const pagination = res.pagination || {};
    blogState.totalPages = Number(pagination.total_pages) || 0;

    if (grid) {
      if (res.articles.length === 0) {
        // Covers BOTH "no articles anywhere yet" and "no articles in this
        // category" — same element, message adapts based on active filter.
        if (!append) {
          grid.innerHTML = `<p class="blog-no-articles">No articles ${blogState.category ? 'in this category ' : ''}yet — check back soon.</p>`;
        }
        // if append and 0 results: nothing new to add, leave existing cards as-is
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
    // CRITICAL: must always reset, even on exception — otherwise every
    // future call (filter clicks, load-more) silently no-ops forever
    // against the `if (blogState.loading) return;` guard above. This was
    // the likely root cause of "filter buttons do nothing".
    blogState.loading = false;
  }
}

function blogLoadMore() {
  blogState.page += 1;
  blogLoadArticles(true);
}

// ── LISTING: category filter (wired via delegated click listener below,
//    not inline onclick — see bottom of file) ──────────────────────────────
function blogFilterByCategory(slug, name) {
  if (!slug) return;
  blogState.category = blogState.category === slug ? null : slug; // click active category again to clear
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

// Delegated listener — survives even if a button's markup gets copy-pasted
// wrong, since it only depends on the CSS class + data attributes, not on
// a hand-typed inline onclick string per button.
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
  blogLoadCategoryCounts();   // ← new
  blogState.initialized = true;
}



// ── ARTICLE DETAIL ──────────────────────────────────────────────────────────
function blogRenderBlock(block) {
  if (!block || !block.type) return '';
  const text = escapeHTML(block.text || '');
  switch (block.type) {
    case 'heading':   return `<h2>${text}</h2>`;
    case 'paragraph': return `<p>${text}</p>`;
    default:          return `<p>${text}</p>`;
  }
}

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

    const contentHTML = (a.content || []).map(blogRenderBlock).join('');

    const faqHTML = (a.faqs && a.faqs.length) ? `
      <h2 style="margin-top:48px;">Frequently Asked Questions</h2>
      <div class="blog-faq-list">
        ${a.faqs.map(f => `
          <details class="blog-faq-item">
            <summary>${escapeHTML(f.question)}</summary>
            <div>${(f.answer || []).map(blogRenderBlock).join('')}</div>
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
      <div class="blog-article-content">${contentHTML}</div>
      ${relatedHTML}
      ${faqHTML}
    `;
  } catch (err) {
    body.innerHTML = `<p class="blog-load-error">Something went wrong loading this article. Please try again shortly.</p>`;
    if (heroTitle) heroTitle.textContent = 'Error';
    if (breadcrumbTitle) breadcrumbTitle.textContent = 'Error';
  }
}