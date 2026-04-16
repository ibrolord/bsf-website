# Cloudflare Cache Rules

Apply these rules on `thebigsisterfoundation.org` after deploying the origin changes in `public/vercel.json`.

Canonical ops runbook: `docs/cloudflare-ops.md`

## 1. Static asset cache rule
- Match:
  - host equals `thebigsisterfoundation.org`
  - and path starts with `/assets/` or `/fonts/`
- Action:
  - Cache eligibility: `Eligible for cache`
  - Browser TTL: `Respect origin`
  - Edge TTL: `Respect origin`

The origin now returns `Cache-Control: public, max-age=31536000, immutable` for those paths, so Cloudflare can serve long-lived first-party hits safely.

## 2. Shared shell asset rule
- Match:
  - host equals `thebigsisterfoundation.org`
  - and path starts with `/shared/`
- Action:
  - Cache eligibility: `Eligible for cache`
  - Browser TTL: `Respect origin`
  - Edge TTL: `Respect origin`

The shared CSS and analytics loader are intentionally revalidating assets, not immutable.

## 3. Anonymous HTML cache rule
Only enable this after the purge script is part of the production deploy flow.

- Match:
  - host equals `thebigsisterfoundation.org`
  - method equals `GET`
  - and path is `/` or starts with `/blog/` or equals `/volunteer/` or equals `/donate/`
  - and path does not start with `/admin/`
- Action:
  - Cache eligibility: `Eligible for cache`
  - Cache level: `Cache Everything`
  - Browser TTL: `Respect origin`
  - Edge TTL: a short TTL such as `5 minutes`

## Purge flow
Run the targeted purge script after production deploys:

```bash
npm run cf:cache:purge
```

To purge a narrower set:

```bash
npm run cf:cache:purge -- / /blog/ /feed.xml
```
