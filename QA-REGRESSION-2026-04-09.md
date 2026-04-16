# BSF Regression Report — thebigsisterfoundation.org

**Date:** 2026-04-09
**Scope:** Public crawl (13 routes) + preflight + static repo cross-check
**Private pass:** skipped (no auth session in browser; policy blocks account creation)
**Reviewers consulted on plan:** Codex (VERDICT: FIX — 6 bugs fixed before execution), Gemini (unavailable, rate-limited)

---

## 🔴 CRITICAL

### C-1 · Revenue · Paystack TEST key on production

**Route:** `/donate/`
**Repo:** `public/donate/index.html:779`

```js
var PAYSTACK_PUBLIC_KEY = 'pk_test_441d40d980617caac1cfbf3a36bcb66921047667';
```

The live site uses a Paystack **test** public key. Any donation made right now runs in test mode — no real money reaches BSF. `TODO-BOLAJI.md` has this as step 7 of go-live, still pending, but the site is already publicly live at the custom domain.

**Fix:** Replace with `pk_live_...` from Paystack dashboard before sharing the donate page publicly. Verify:

```bash
curl -s https://thebigsisterfoundation.org/donate/ | grep -o 'pk_[a-z]*_' | head -1
# Expected: pk_live_
```

---

## 🟠 MAJOR

### M-1 · SEO · robots.txt sitemap URL points to preview domain

**Route:** `/robots.txt`

```
Sitemap: https://public-mu-steel.vercel.app/sitemap.xml
```

Search engines crawl `robots.txt`, follow the sitemap link, and land on the Vercel preview domain. The actual sitemap at `thebigsisterfoundation.org/sitemap.xml` works fine, but robots.txt points elsewhere.

**Fix:** Change to `Sitemap: https://thebigsisterfoundation.org/sitemap.xml` in `public/robots.txt`.

### M-2 · SEO + A11y · Blog posts are non-anchor `<article>` with JS click delegation

**Route:** `/blog/`
**Repo:** `public/blog/index.html:968, 1103-1110`

74 posts render as `<article class="post-card" data-id="...">` with a single click handler on `#blogGrid`. Consequences:

- No per-post URL → Google cannot index individual posts → 74 pieces of SEO content invisible
- Not keyboard-reachable (Tab skips them)
- Screen readers don't announce as links
- No right-click → "Open in new tab", no "Copy link"
- No share links possible

**Fix:** Wrap card in `<a href="/blog/?id=' + post.id + '">` (or push to real routes via History API) and let the existing click handler intercept for SPA behavior. Add `aria-label` with post title.

### M-3 · SEO · Sitemap missing half the site

**Route:** `/sitemap.xml`

Contains only 9 URLs. Missing: `/events/`, `/forums/`, `/communities/` (redirect OK to skip), `/signin/`, `/admin/` (correctly excluded), and all blog post detail URLs.

**Fix:** Regenerate sitemap to include `/events/`, `/forums/`, `/blog/` detail URLs (once M-2 gives them real routes).

---

## 🟡 MINOR

### m-1 · UX · Dead Instagram link on homepage

**Route:** `/`
Vision section has `<a href="#">Instagram</a>` in `.vision__buttons`. Either link to the real IG handle or remove.

### m-2 · UX · `/signin/` has no `<form>` wrapper

**Route:** `/signin/`
Inputs exist (`vol-email`, `vol-pw`, `sp-email`, `sp-pw`) but not wrapped in `<form>`. Enter key won't submit; no HTML5 validation; password managers have degraded autofill.

**Fix:** Wrap each role's inputs in `<form onsubmit="return false">` and handle via submit listener.

### m-3 · UX · `/signin/` has zero mobile `@media` queries

**Route:** `/signin/index.html`
0 media queries in the file. Every other major route has mobile styles. Likely works on mobile because inputs are `width:100%`, but no mobile-specific padding/spacing tuning.

**Fix:** Add a `@media (max-width: 640px)` block with appropriate button/input sizing.

### m-4 · Infra · Missing security response headers

**Route:** sitewide
Missing: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Only `Strict-Transport-Security` is set (by Cloudflare).

**Fix:** Add to `public/vercel.json` → `headers` block. CSP is delicate because of Firebase, Paystack, gtag — start in `Content-Security-Policy-Report-Only` mode.

### m-5 · SEO · `og:image` is SVG

**Route:** `/`
`og:image` points to `/og-image.svg`. Facebook, LinkedIn, and several crawlers won't render SVG OG images. Twitter specifically requires JPEG/PNG/WebP/GIF.

**Fix:** Export a 1200x630 PNG/JPG and update `<meta property="og:image">`.

### m-6 · Data · `/scholars/` stats inconsistent with ledger

**Route:** `/scholars/`
Aggregate stats on scholars page are "--" for avg performance and total investment, while `/ledger/` shows ₦7.5M total received / ₦3.7M spent. Likely a data-state issue (scholars page not aggregating ledger data), not a code bug, but visible to any visitor comparing the two pages.

---

## ℹ️ Informational / Verified Clean

- HSTS + HTTPS enforced via Cloudflare + Vercel ✓
- All 13 probed routes return 200, unknown slug returns real 404 ✓
- No broken images on any probed route ✓
- No console errors from BSF code (only unrelated Chrome extension noise) ✓
- Firebase apps initialized correctly on pages that need it (`/events/`, `/ideas/`, `/forums/`, `/scholars/`, `/donate/`, `/sponsor/`) ✓
- `/donate/` form has honeypot bot fields (`bsf_website`, `bsf_confirm_email`) ✓
- `/signin/` lazy-initializes Firebase on role click (not on page load) — intentional, works ✓
- Ledger renders transactions correctly ✓
- 404 page is branded and has helpful nav ✓
- robots.txt correctly disallows `/admin/` and `/sponsor/dashboard.html` ✓
- Home/donate performance: DOMContentLoaded ~2.2s, load ~3.1s — acceptable ✓
- Canonical, Twitter card, OG tags present on home ✓
- Favicon uses inline SVG data URL (404 on `/favicon.ico` is harmless) ✓

---

## ⚠️ Coverage Gaps (what was NOT tested)

1. **Private/admin regression** — no auth session in Chrome, and account creation is off-limits by policy. To run this: log into `/admin/` manually first, then re-run regression.
2. **True mobile rendering** — `resize_window` changed OS window but viewport stayed at desktop width; couldn't force touch/DPR emulation. Mobile findings are from static repo analysis only (media query presence), not actual layout checks.
3. **Paystack full flow** — intentionally stopped before `PaystackPop.setup().openIframe()` to avoid polluting production telemetry. Didn't verify iframe opens / modal closes / webhook fires.
4. **Blog/event/idea detail views** — click-delegation based (no URLs), couldn't deep-link to a specific post.
5. **Firestore security rules** — needs admin session to probe write permissions from browser; only verified public reads work.
6. **Gemini architecture review of the plan** — rate-limited (model capacity exhausted). Codex review only.

---

## Priorities

1. **C-1 first** (Paystack live key) — ship-blocker for any donation marketing.
2. **M-1 robots.txt** (one-line fix) and **M-3 sitemap** — batch with a sitemap regen.
3. **M-2 blog anchors** — bigger lift but unlocks SEO + a11y for all 74 posts.
4. Minor items can be batched into a single polish PR.

---

## Routes Probed

| Route | Status | Notes |
|---|---|---|
| `/` | 200 | 1 dead anchor (IG) |
| `/donate/` | 200 | **CRITICAL: pk_test key** |
| `/signin/` | 200 | No `<form>`, no mobile CSS |
| `/events/` | 200 | 5 event cards, Firebase init OK |
| `/blog/` | 200 | **74 non-anchor article cards** |
| `/communities/` | 200 | Redirects to `/scholars/?view=communities` |
| `/ideas/` | 200 | 13 vote buttons, Firebase OK |
| `/volunteer/` | 200 | Clean |
| `/sponsor/` | 200 | Clean |
| `/scholars/` | 200 | Stats inconsistent with ledger |
| `/ledger/` | 200 | ₦7.5M received, transactions render |
| `/forums/` | 200 | 6 threads |
| `/admin/` | 200 | Email/password gate, unauthenticated |
| `/404.html` | 200 | Custom 404 page |
| `/zzz-nonexistent-qa` | 404 | Real 404 status ✓ |
| `/programs` | 404 | Not in repo (no references found) |
