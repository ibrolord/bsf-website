# Big Sister Foundation — Complete Site Documentation

> **Purpose of this doc:** Give any AI or developer full context to pick up this project cold. Covers architecture, every page, shared libraries, API routes, data flow, auth model, external services, known kinks, and file map.

---

## 1. Project Overview

**What:** Static website for Big Sister Foundation (BSF), a nonprofit supporting vulnerable children in Lagos, Nigeria. Offers mentorship, sponsorship, and volunteer programs.

**Stack:** Pure HTML/CSS/JS (no framework). Deployed on **Vercel** as a static site with serverless API routes (`/api/*`).

**Repo:** `ibrolord/threatgenix` → branch `feat/bsf-website`
**Site root:** `TrashShit/claudecode/VNtranscript/public/`
**Live URL:** `https://public-mu-steel.vercel.app`

---

## 2. Site Map (All Pages)

| Route | File | Auth Required | Purpose |
|-------|------|---------------|---------|
| `/` | `index.html` | None | Landing page — mission, pathways, founder story |
| `/donate/` | `donate/index.html` | None | Fund picker + Paystack checkout |
| `/donations/` | `donations/index.html` | Volunteer | Volunteer donation tracking + receipt generation |
| `/events/` | `events/index.html` | Volunteer | Calendar, RSVP, event CRUD |
| `/forums/` | `forums/index.html` | Optional | Community threads, replies, voting |
| `/ideas/` | `ideas/index.html` | Volunteer | Ideas board, voting, goal promotion |
| `/ledger/` | `ledger/index.html` | None | Public real-time donation ledger |
| `/scholars/` | `scholars/index.html` | Volunteer (edit) | Scholar profiles, progress, sponsor assignment |
| `/volunteer/` | `volunteer/index.html` | None | Volunteer pitch/landing page |
| `/volunteer/register/` | `volunteer/register/index.html` | None | Application form (with invite link support) |
| `/volunteer/dashboard/` | `volunteer/dashboard/index.html` | Volunteer | Stats, assignments, activity feed |
| `/sponsor/` | `sponsor/index.html` | None | Sponsor program pitch page |
| `/sponsor/dashboard.html` | `sponsor/dashboard.html` | Sponsor | Sponsor portal (scholars, donations, messages) |
| `/signin/` | `signin/index.html` | None | Multi-role sign-in (Volunteer vs Sponsor) |
| `/blog/` | `blog/index.html` | None | Blog/news feed |
| `/docs/` | `docs/index.html` | None | Help center / FAQs |
| `/404.html` | `404.html` | None | Not found page with quick links |

**Kink:** Sponsor dashboard uses `dashboard.html` instead of `dashboard/index.html` — inconsistent with the rest of the site's routing pattern.

---

## 3. Navigation Structure

All public pages share a consistent top nav:

```
Home | Scholars | Ledger | Events | Volunteer | Give (→ /donate/)
```

Footer adds: Forums, Ideas, Sponsor, Email link

Admin and portal pages have their own nav bars.

---

## 4. Authentication Model

### Two Separate Firebase Apps

The site runs **two independent Firebase projects** with different credentials:

| Role | Firebase API Key | Auth Flow | Post-Login Redirect |
|------|-----------------|-----------|---------------------|
| Volunteer | `AIzaSyBm-d9DPG4iKbmhEA71E6cBxAHmcVgrdTs` | Email/password sign-in only (no sign-up — must be approved first) | `/volunteer/dashboard/` |
| Sponsor | `AIzaSyCwos6XR9-uqAf_Esmh2K_hJoLxq4gnEuU` | Email/password sign-in OR create account | `/sponsor/dashboard.html` |

**Volunteer onboarding flow:**
1. User submits application at `/volunteer/register/`
2. Admin reviews at `/admin/` → approves or rejects
3. On approve: admin creates Firebase Auth user + sends EmailJS approval email with registration link
4. On reject: sends EmailJS rejection email
5. Approved volunteer signs in at `/signin/`

**Sponsor onboarding flow:**
1. Sponsor creates account at `/signin/` (sponsor tab → create account)
2. Firebase Auth user created + Firestore `sponsors` doc with `tier: 'seedling'`
3. Signs in → redirected to `/sponsor/dashboard.html`

**Kink:** Two separate Firebase apps means session management is split. A user can't be both a volunteer and sponsor with the same credentials. No visible reCAPTCHA or rate-limiting on sign-in attempts.

---

## 5. External Services

| Service | Purpose | Where Used | Config Notes |
|---------|---------|------------|--------------|
| **Firebase Firestore** | All data storage (volunteers, sponsors, applications, threads, ideas, goals, scholars, donations, events, invites) | Nearly every page | Two separate projects (volunteer & sponsor) |
| **Firebase Auth** | User authentication | `/signin/`, portals, admin | Two separate apps |
| **Paystack** | Payment processing | `/donate/`, sponsor dashboard | **TEST KEY HARDCODED** in `bsf-paystack.js` — must swap for production |
| **EmailJS** | Approval/rejection emails | `/admin/` | API keys likely in admin page JS |
| **Google Analytics** | Page tracking | All pages | ID: `G-Q4EYY24EDZ` |
| **Google Fonts** | EB Garamond serif font | All pages | |
| **Vercel** | Hosting + serverless functions | Deployment | Vercel Insights on 404 page |
| **Cloudflare Turnstile** | Optional anti-spam CAPTCHA | Forms via `bsf-antispam.js` | Site key is `null` by default (disabled) |
| **Perplexity API** | Blog research + rank tracking | `/api/generate-post.js` | Model: `sonar` |
| **Grok API (x.ai)** | Blog trend validation | `/api/generate-post.js` | Model: `grok-3-mini-fast`, falls back to OpenAI |
| **Google Gemini** | Blog outline generation | `/api/generate-post.js` | Model: `gemini-2.0-flash`, falls back to OpenAI |
| **Claude API** | Blog writing + revision | `/api/generate-post.js` | Model: `claude-sonnet-4-20250514` |
| **OpenAI API** | Blog review + fallback | `/api/generate-post.js` | Model: `gpt-4o-mini` |
| **GitHub API** | Blog post persistence | `/api/generate-post.js` | Commits to `feat/bsf-website` branch when `GITHUB_TOKEN` is present |
| **Openverse API** | Live blog cover image search | `/api/post-cover.js` + `/api/_lib/openverse.js` | Reusable images, then OG fallback |

---

## 6. Shared Libraries (`/shared/`)

### `bsf-store.js` — Client-side data layer
- localStorage wrapper with optional Firestore sync
- Storage keys: `bsf_sponsor_profile`, `bsf_transactions`, `bsf_session`
- Key functions: `getSponsor()`, `saveSponsor()`, `addTransaction()`, `getTotalDonated()`, `syncToFirestore()`, `generateRef()` (format: `BSF-YYYYMMDD-XXXXXX`)
- **Kink:** No localStorage quota handling. No encryption for sensitive data.

### `bsf-paystack.js` — Payment integration
- Wraps Paystack inline checkout
- Multi-currency: NGN, USD, GBP, EUR, CAD (with symbols, flags, presets)
- Sponsorship tier logic:
  - Baobab (≥₦50,000/mo) 🌳
  - Elder (≥₦25,000/mo) 🌲
  - Grower (≥₦10,000/mo) 🌱
  - Seedling (<₦10,000/mo) 🌾
- **CRITICAL KINK:** `publicKey` is a **test key** (`pk_test_xxx...`). Must replace before going live.
- Currency conversion rates for tier calculation are hardcoded approximations, not live rates.

### `bsf-receipt.js` — Donation receipts
- Generates printable HTML receipt in a popup window
- Uses browser print dialog for "Save as PDF"
- Branded with BSF colors + inline SVG logo
- Escapes HTML (XSS-safe)
- **Kink:** 600ms font loading delay before triggering print. Pop-up blockers will prevent it (shows alert).

### `bsf-antispam.js` — Form protection
- Layers: honeypot fields, timing check (min 2s), rate limiting (5/min via localStorage), optional Cloudflare Turnstile
- Used on: volunteer register, forums, ideas
- Call `protect(formId)` on load, `validate(formId)` on submit
- **Kink:** Turnstile is disabled by default (`turnstileSiteKey: null`). Honeypot field names are predictable. Rate limiting is localStorage-based (clearable).

---

## 7. API Routes (`/api/`)

All are Vercel serverless functions.

### `GET /api/generate-post.js` — AI Blog Generator
**The most complex file in the project.** 5-stage AI pipeline:
1. **Cluster selection** → pick least-covered topic from 4 pillars × 5 subtopics
2. **Research** (Perplexity) → SEO gaps, trending topics
3. **Validation** (Grok) → confidence scoring, emotional angle
4. **Outline** (Gemini) → section structure, keyword map
5. **Writing** (Claude) → full post (750-1000 words, Markdown)
6. **Review** (OpenAI) → SEO score, readability, fixes
7. **Revision** (Claude) → incorporate feedback
8. **Interlinking** → cross-post links
9. **Snippet** → featured snippet block for Position 0
10. **Rank check** (Perplexity) → track keyword positions
11. **GitHub commit** → persist to `data/ai-posts.json`

**Auth:** `Authorization: Bearer {CRON_SECRET}` header

**Env vars required to generate:** `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. `PERPLEXITY_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY` are optional and have fallbacks. `GITHUB_TOKEN` is only required to publish the generated post back to the repo.

**SEO thresholds:** min score 70, keyword density 0.8-2.5%, title 40-70 chars, meta desc 120-165 chars, min 2 internal links.

**Visible media metadata written to AI posts:** `coverImage`, `coverImageAlt`, `coverImageOriginal`, `coverImageProvider`, `coverImageCreator`, `coverImageLicense`, `coverImageLicenseVersion`, `coverImageSource`, `coverImageSourceUrl`, `coverImageSearchQuery`.

**Topic control:** cluster selection is authoritative by default. Research may override only when the returned topic stays inside the selected pillar and keyword family. The route returns and stores `topicSource` and `topicOverrideReason`.

**Kinks:**
- No post deduplication (same topic could be generated twice)
- Sequential API calls — 5+ external services per run, could timeout
- Hardcoded author assignment by category (story→Funke, guide→Amara, update→BSF Team, else→Bolaji)
- GitHub publish is skipped entirely when `GITHUB_TOKEN` is absent

### `GET /api/posts.js` — Blog Posts JSON
- Returns all posts from `data/ai-posts.json`
- CORS: `*` (public)
- Cache: 60s max-age, 300s stale-while-revalidate
- Falls back to empty array if file missing

### `GET /api/feed.js` — RSS Feed
- RSS 2.0 from latest 20 posts
- Cache: 1 hour, 10-min stale-while-revalidate
- **Kink:** Hardcoded base URL `https://public-mu-steel.vercel.app`

### `GET /api/og-image.js` — Dynamic OG Images
- Returns SVG (1200×630) for social sharing
- Query params: `title`, `category`, `author`, `keyword`
- Category colors: story=#C2734C, update=#2D5E40, insight=#D4A96A, guide=#8BAF8E
- Cache: 1 day browser, 7 day CDN

### `GET /api/post-cover.js` — Visible Blog Cover Resolver
- Redirects to a pinned preferred image when available and still valid
- Otherwise searches Openverse in real time for a reusable image that matches the post topic
- Falls back to `/api/og-image` only if no usable photo is found
- Used for visible blog listing/detail media, not for social share cards

### `GET /api/sitemap.js` — XML Sitemap
- 9 static pages + dynamic blog post entries
- **Kink:** Same hardcoded base URL. Blog post URLs use query params (`/blog/?post={id}`) — not ideal for SEO.

---

## 8. Firestore Collections

| Collection | Used By | Key Fields |
|-----------|---------|------------|
| `volunteers` | Admin, portals, dashboard | name, email, roles, status |
| `sponsors` | Sponsor dashboard, signin | name, email, tier, createdAt |
| `applications` | Admin, volunteer register | name, email, roles, motivation, status |
| `forum_threads` | Forums | title, body, author, category, votes, createdAt |
| `forum_threads/{id}/replies` | Forums | body, author, createdAt |
| `ideas` | Ideas page | title, description, category, votes, status |
| `goals` | Ideas page, donate page | amount, deadline, beneficiary, description, status |
| `scholars` | Scholars page | name, age, school, background, needs, sponsor |
| `donations` / `transactions` | Ledger, donate page | donorName, amount, fund, date, ref |
| `events` | Events page | title, date, time, location, category, description |
| `invites` | Volunteer register | email, roles, status |

---

## 9. Design System

### Colors
```
Primary Green:  #2D5E40
Dark Green:     #1E3F2B / #1E4A2F
Brown (text):   #3A2A1F
Terra (accent): #C2734C
Gold:           #D4A96A
Sage (muted):   #8BAF8E
Cream (bg):     #FFF8F0 / #FAF7F2
```

### Typography
- **Serif:** EB Garamond (Google Fonts) — headings
- **Sans:** system-ui — body text
- Fluid sizing with CSS `clamp()`

### Layout
- Max-width: 1200px containers
- Responsive padding with `clamp()`
- Mobile breakpoint: 768px (hamburger menu)
- Scroll-triggered animations via IntersectionObserver (`data-animate` attributes)
- Glassmorphism on dark sections

---

## 10. Key User Flows

### Donate Flow
```
/donate/ → pick fund(s) → enter amount → fill name/email → Pay with Paystack
         → Paystack popup → success callback → receipt generation → transaction saved to Firestore
```

### Volunteer Onboarding
```
/volunteer/ (pitch) → /volunteer/register/ (apply) → Admin reviews at /admin/
  → Approved: EmailJS sends approval email with invite link
  → Invite link → /volunteer/register/?invite={id} (pre-fills email)
  → /signin/ (volunteer tab) → /volunteer/dashboard/
```

### Sponsor Onboarding
```
/sponsor/ (pitch) → /signin/ (sponsor tab → create account)
  → Firebase Auth + Firestore sponsor doc (tier: seedling)
  → /sponsor/dashboard.html
```

### Idea → Goal Flow
```
/ideas/ → volunteer submits idea → community votes
  → volunteer promotes idea to goal (sets amount + deadline)
  → goal appears on /donate/ as active goal
```

### Blog Auto-Generation
```
Cron trigger → /api/generate-post.js
  → Perplexity researches → Grok validates → Gemini outlines
  → Claude writes → OpenAI reviews → Claude revises
  → Interlinks injected → Snippet added → Ranking checked
  → GitHub commit to data/ai-posts.json
  → /blog/ reads from /api/posts.js → /api/feed.js for RSS
```

---

## 11. Email Templates

Located at `/admin/emailjs-templates/`:

- **`template_approve.html`** — Approval email with green badge, role list, CTA button to complete registration
- **`template_reject.html`** — Empathetic rejection with "stay connected" section, encourages reapplication

Both use BSF branding (dark green header, copper accents, cream body). Table-based layout for email client compatibility.

**Template variables:** `{{to_name}}`, `{{message}}`, `{{roles}}` (approve only), `{{registration_link}}` (approve only)

**Kink:** No unsubscribe link in either template (may be legally required depending on jurisdiction).

---

## 12. Known Kinks & Issues

### Critical (Must Fix Before Production)
1. **Paystack test key hardcoded** in `bsf-paystack.js` — payments won't process in production
2. **Hardcoded base URL** (`https://public-mu-steel.vercel.app`) in feed.js, sitemap.js — needs env var
3. **Blog post URLs use query params** (`/blog/?post={id}`) — bad for SEO, should use slugs

### Security
4. Firebase API keys in client code (expected for Firebase, but worth noting)
5. EmailJS API keys likely exposed in admin page
6. CORS `*` on `/api/posts.js` (acceptable for public data)
7. No reCAPTCHA on sign-in (relies on Firebase rate limiting)
8. Cloudflare Turnstile disabled by default in anti-spam

### Architecture
9. Two separate Firebase projects for volunteer vs sponsor — adds complexity
10. Sponsor dashboard route (`dashboard.html`) breaks the `*/index.html` convention
11. No offline support / service worker
12. No dark mode
13. Blog data stored as flat JSON file committed to git (not a database)
14. No pagination on ledger page (could be slow with thousands of transactions)

### Content / UX
15. No moderation interface for forums (threads are unmoderated)
16. No undo for admin approvals
17. Scholar photo upload mechanism not visible
18. Blog post deduplication not implemented
19. Currency conversion rates for tier calculation are static approximations
20. Receipt generation relies on popup windows (blocked by many browsers)

### Missing Features
21. Volunteer messaging system (referenced in dashboard, not implemented)
22. Blog CMS (content generated by AI, no manual editor)
23. Accessibility (limited ARIA labels across the site)
24. Mobile app (responsive web only)

---

## 13. Environment Variables

For Vercel deployment:

```
# Required
ANTHROPIC_API_KEY=       # Claude API for blog generation
OPENAI_API_KEY=          # GPT-4o-mini for blog review + fallback
GITHUB_TOKEN=            # Optional for generation, required for committing blog posts to repo

# Optional (has fallbacks)
PERPLEXITY_API_KEY=      # Blog research (falls back to cluster data)
GROK_API_KEY=            # Blog validation (falls back to OpenAI)
GEMINI_API_KEY=          # Blog outline (falls back to OpenAI)
CRON_SECRET=             # Auth for /api/generate-post.js

# Needs to be set in code before production
# bsf-paystack.js publicKey → replace test key with live key
```

---

## 14. File Map

```
public/
├── index.html                          # Homepage
├── 404.html                            # Not found
├── admin/
│   ├── index.html                      # Admin panel
│   └── emailjs-templates/
│       ├── template_approve.html       # Approval email
│       └── template_reject.html        # Rejection email
├── api/
│   ├── feed.js                         # RSS feed endpoint
│   ├── _lib/openverse.js               # Openverse cover image search + scoring
│   ├── generate-post.js                # AI blog generator (5-agent pipeline)
│   ├── og-image.js                     # Dynamic OG image SVG
│   ├── post-cover.js                   # Visible blog cover image resolver
│   ├── posts.js                        # Blog posts JSON endpoint
│   └── sitemap.js                      # XML sitemap
├── blog/
│   └── index.html                      # Blog page
├── docs/
│   └── index.html                      # Help center
├── donate/
│   └── index.html                      # Donation checkout
├── donations/
│   └── index.html                      # Volunteer donation tracking
├── events/
│   └── index.html                      # Events calendar
├── forums/
│   └── index.html                      # Community forums
├── ideas/
│   └── index.html                      # Ideas & goals board
├── ledger/
│   └── index.html                      # Public donation ledger
├── scholars/
│   └── index.html                      # Scholar profiles
├── shared/
│   ├── bsf-antispam.js                # Anti-spam (honeypot, timing, rate limit, Turnstile)
│   ├── bsf-paystack.js                # Paystack payment wrapper
│   ├── bsf-receipt.js                  # Receipt HTML generator
│   └── bsf-store.js                    # localStorage + Firestore sync
├── signin/
│   └── index.html                      # Multi-role auth page
├── sponsor/
│   ├── index.html                      # Sponsor pitch page
│   └── dashboard.html                  # Sponsor dashboard (⚠️ not index.html)
└── volunteer/
    ├── index.html                      # Volunteer pitch page
    ├── dashboard/
    │   └── index.html                  # Volunteer dashboard
    ├── portal/
    │   └── index.html                  # Authenticated portal hub
    └── register/
        └── index.html                  # Application form
```

---

## 15. Quick Reference for AI Agents

**To add a new page:** Create `pagename/index.html`, copy nav from any existing page, add route to sitemap.js static pages array.

**To modify nav:** Update the nav HTML in every page (no shared component — it's duplicated across all files).

**To add a Firestore collection:** Just start writing to it from client-side JS. Firebase rules need to be configured separately (not in this repo).

**To modify payment:** Edit `shared/bsf-paystack.js`. The `pay()` function accepts options with `amount`, `email`, `currency`, `metadata`, `onSuccess`, `onClose`.

**To modify blog generation:** Edit `api/generate-post.js`. Topic clusters are hardcoded in the `TOPIC_CLUSTERS` constant. SEO thresholds live in `SEO_CONFIG`. Visible cover-image search lives in `api/post-cover.js` and `api/_lib/openverse.js`.

**To modify design:** Colors are CSS variables defined per-page (not in a shared stylesheet). The canonical palette is in Section 9 above.

**Key gotcha:** There is NO shared CSS file or component system. Every page has its own inline `<style>` block and duplicated nav HTML. Changes to global elements require editing every page individually.
