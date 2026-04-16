# BSF Cloudflare Ops

This repo uses Vercel as the production origin and Cloudflare as the production control plane for `thebigsisterfoundation.org`.

- Scope: production only
- Hosting boundary: Vercel deploys the site, Cloudflare manages DNS, cache, email routing, and Turnstile readiness
- CLI policy: use the repo-local `wrangler` from this directory, not the machine-global binary
- Config policy: dashboard remains the source of truth for zone settings; this repo is the source of truth for command entrypoints, env names, validation scripts, and operating procedure

## 1. Install The Local CLI

From [`bsf-website`](/Users/ibrobaba/codex/bsf-website):

```bash
npm install
npx wrangler --version
```

This pins Wrangler via [`package.json`](/Users/ibrobaba/codex/bsf-website/package.json).

## 2. Configure Local Secrets

Copy the example file and fill in the real values locally:

```bash
cp .env.cloudflare.example .env.cloudflare.local
```

Required values:

- `CLOUDFLARE_ZONE_NAME=thebigsisterfoundation.org`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` when a command needs account-scoped endpoints

Optional values:

- `BASE_URL=https://thebigsisterfoundation.org`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Token guidance:

- Start with a scoped API token, not a global API key.
- Minimum practical scopes for this runbook are zone read, DNS read, and email-routing read/edit only if you intend to manage routing with the API.

## 3. Login And Verify Local Access

Interactive auth is first-class for local operator verification:

```bash
npm run cf:whoami
```

If that reports not logged in, run:

```bash
npx wrangler login
npm run cf:whoami
```

`cf:whoami` proves the local CLI session is healthy. The REST-backed scripts below use `CLOUDFLARE_API_TOKEN`.

## 4. Confirm The Zone And Account IDs

Run:

```bash
npm run cf:zone:report
```

Expected outcomes:

- zone resolves to `thebigsisterfoundation.org`
- output includes the active `Zone ID`
- output includes the `Account` identifier
- current nameservers are printed
- DNS record counts and proxied hostnames are summarized

If `CLOUDFLARE_ZONE_ID` is blank but the token can read the zone, the script will resolve the zone by name and print the ID you should keep in `.env.cloudflare.local`.

## 5. Export DNS Before Any Change

Always export the current DNS state before changing records:

```bash
npm run cf:dns:export
```

Default output path:

- `artifacts/cloudflare/dns/<timestamp>-thebigsisterfoundation.org.json`

You can pass a custom output path:

```bash
npm run cf:dns:export -- ./artifacts/cloudflare/dns/pre-cutover.json
```

This export is the rollback reference if a record change goes wrong.

## 6. Safe DNS Change Procedure For A Vercel Origin

For production DNS work:

1. Export DNS first with `npm run cf:dns:export`.
2. Confirm the Vercel production target and desired hostname behavior.
3. Change only the intended record in the Cloudflare dashboard.
4. Keep orange-cloud proxy settings aligned with the desired behavior:
   - proxied for public web traffic where Cloudflare should sit in front
   - DNS-only only when a record should bypass the proxy
5. Re-run `npm run cf:zone:report` and verify the target record state.
6. Verify the live site on `https://thebigsisterfoundation.org`.

Do not introduce Workers or Pages deployment config into this repo. BSF stays Vercel-hosted.

## 7. Email Routing Verification

Run:

```bash
npm run cf:email:status
```

This checks:

- whether Email Routing appears enabled for the zone
- whether the documented aliases exist
- whether their destinations match the current repo expectation from [`public/TODO-BOLAJI.md`](/Users/ibrobaba/codex/bsf-website/public/TODO-BOLAJI.md)

Current documented expectation:

- `hello@thebigsisterfoundation.org`
- `give@thebigsisterfoundation.org`
- both forward to the destination documented in [`public/TODO-BOLAJI.md`](/Users/ibrobaba/codex/bsf-website/public/TODO-BOLAJI.md)

If the script cannot resolve account-scoped address data, confirm `CLOUDFLARE_ACCOUNT_ID` is set and the token has email-routing read access.

## 8. Cache Rules And Purge Flow

The origin cache headers live in [`public/vercel.json`](/Users/ibrobaba/codex/bsf-website/public/vercel.json). The Cloudflare-side rule inventory lives in [`docs/cloudflare-cache-rules.md`](/Users/ibrobaba/codex/bsf-website/docs/cloudflare-cache-rules.md).

Check local cache invariants with:

```bash
npm run cf:cache:status
```

Purge after every production deploy:

1. deploy production on Vercel
2. wait for deploy completion
3. run the Cloudflare purge

Default purge:

```bash
npm run cf:cache:purge
```

Targeted purge:

```bash
npm run cf:cache:purge -- / /blog/ /feed.xml
```

The legacy script path [`scripts/purge-cloudflare-cache.mjs`](/Users/ibrobaba/codex/bsf-website/scripts/purge-cloudflare-cache.mjs) remains as a compatibility shim, but the canonical entrypoint is `npm run cf:cache:purge`.

## 9. Turnstile Is Explicitly Gated

Check readiness with:

```bash
npm run cf:turnstile:status
```

Current rule:

- do not enable production Turnstile yet

Reason:

- the client helper in [`public/shared/bsf-antispam.js`](/Users/ibrobaba/codex/bsf-website/public/shared/bsf-antispam.js) only checks for presence of `cf-turnstile-response`
- that is not real verification
- production Turnstile must stay blocked until a server-side Siteverify path exists and `TURNSTILE_SECRET_KEY` is actually used

When that backend verification exists, re-run `npm run cf:turnstile:status` before turning it on.

## 10. Rollback Guidance

If a DNS or cache change causes regressions:

1. stop making additional changes
2. use the latest DNS export from `artifacts/cloudflare/dns/`
3. restore the previous record values in the Cloudflare dashboard
4. re-run `npm run cf:zone:report`
5. verify the live hostname from the browser
6. purge affected URLs if stale cached HTML is part of the issue

For cache-only mistakes:

1. keep origin config unchanged unless it is actually wrong
2. fix the Cloudflare dashboard rule
3. run `npm run cf:cache:purge -- <affected paths>`
4. verify the live responses again
