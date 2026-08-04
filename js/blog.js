/**
 * DR. PUJA'S CLINIC — blog.js
 * Dynamic Blog listing: featured article slot + latest articles (paginated).
 * Category grid is intentionally left static (see PROJECT-RECONCILIATION notes) —
 * only 1 test category exists in the DB so far, the real 7 don't yet.
 * Article DETAIL rendering is a separate later phase (needs a new hash
 * sub-route — not yet added to main.js's router).
 * Depends on: booking.js (bwApi, escapeHTML)
 */
'use strict';

const blogState = {
  page: 1,
  pageSize: 9,
  totalPages: 0,
  loading: false,
  initialized: false, // avoids redundant refetches if showPage('blog') fires more than once in a session
};

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
    <article class="blog-card" onclick="location.hash='blog/${encodeURIComponent(a.slug)}'" role="button" tabindex="0" aria-label="${escapeHTML(a.title)}">
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

  const res = await bwApi('/blog/articles?featured=1&page_size=1');
  if (!res.success || !res.articles || res.articles.length === 0) {
    // No featured article yet — hide the whole "Start Here" block rather
    // than show an empty/broken-looking card.
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
    <div class="featured-article-body" onclick="location.hash='blog/${encodeURIComponent(a.slug)}'" role="button" tabindex="0" style="cursor:pointer;">
      <div class="blog-tag">${escapeHTML(a.category.name)}</div>
      <h3>${escapeHTML(a.title)}</h3>
      <p>${escapeHTML(a.summary)}</p>
      <div class="blog-meta">${escapeHTML(a.author.name)}${a.read_minutes ? ' · ' + a.read_minutes + ' min read' : ''}</div>
    </div>`;
}

async function blogLoadArticles(append = false) {
  if (blogState.loading) return;
  blogState.loading = true;

  const grid = document.getElementById('blogArticlesGrid');
  const loadMoreBtn = document.getElementById('blogLoadMoreBtn');
  if (!append && grid) grid.innerHTML = `<p class="blog-loading">Loading articles…</p>`;
  if (loadMoreBtn) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Loading…'; }

  const params = new URLSearchParams({ page: String(blogState.page), page_size: String(blogState.pageSize) });
  const res = await bwApi(`/blog/articles?${params.toString()}`);
  blogState.loading = false;

  if (!res.success) {
    if (grid) grid.innerHTML = `<p class="blog-load-error">Could not load articles right now. Please try again shortly.</p>`;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  blogState.totalPages = res.pagination.total_pages;
  const html = res.articles.map(blogArticleCardHTML).join('');

  if (grid) {
    if (res.articles.length === 0 && !append) {
      grid.innerHTML = `<p class="blog-no-articles">No articles published yet — check back soon.</p>`;
    } else if (append) {
      grid.insertAdjacentHTML('beforeend', html);
    } else {
      grid.innerHTML = html;
    }
  }

  if (loadMoreBtn) {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More Articles';
    loadMoreBtn.style.display = blogState.page < blogState.totalPages ? 'block' : 'none';
  }
}

function blogLoadMore() {
  blogState.page += 1;
  blogLoadArticles(true);
}

function blogInit() {
  if (!document.getElementById('page-blog')) return; // safety guard
  blogState.page = 1;
  blogLoadFeatured();
  blogLoadArticles();
  blogState.initialized = true;
}
