#!/usr/bin/env bash
#
# Test the Big Sister Foundation AI blog pipeline WITHOUT publishing.
#
# Runs the real generation pipeline in dry-run mode against production: it
# researches, writes, and SEO-checks a complete post, prints it for you to
# read, and publishes NOTHING to the live blog. Run it as often as you like.
#
# Requirements: the Vercel CLI, logged in to the account that owns the
# "public" project. Takes ~2 minutes per run.
#
# Usage:  ./scripts/test-blog.sh
#
set -euo pipefail

# Locate the directory linked to the Vercel "public" project (public/ or repo root).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINK=""
for d in "$ROOT/public" "$ROOT"; do
  if [ -f "$d/.vercel/project.json" ] \
     && grep -qE '"projectName"[[:space:]]*:[[:space:]]*"public"' "$d/.vercel/project.json"; then
    LINK="$d"; break
  fi
done
if [ -z "$LINK" ]; then
  echo "✗ Couldn't find the Vercel link for project 'public'. Run 'vercel link' first." >&2
  exit 1
fi

echo "→ Pulling the cron secret from Vercel…"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
vercel env pull "$TMP" --environment=production --yes --cwd "$LINK" >/dev/null 2>&1
CRON_SECRET="$(grep '^CRON_SECRET=' "$TMP" | cut -d= -f2- | tr -d '"')"
rm -f "$TMP"; trap - EXIT
if [ -z "$CRON_SECRET" ]; then
  echo "✗ Couldn't read CRON_SECRET. Is the Vercel CLI logged in to the right account?" >&2
  exit 1
fi

# Resolve the current production deployment URL. `vercel ls` prints its table
# to stderr, so merge it in; `|| true` keeps set -e from killing us on no match.
echo "→ Finding the current production deployment…"
LS_OUT="$(vercel ls public --cwd "$LINK" 2>&1 || true)"
PROD="$(printf '%s\n' "$LS_OUT" \
  | awk '/Production/ && /Ready/ {print; exit}' \
  | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | head -1 | sed 's#https://##' || true)"
if [ -z "$PROD" ]; then
  echo "✗ Couldn't find the production deployment (is the Vercel CLI logged in?)." >&2
  exit 1
fi

# Hit it through `vercel curl` (handles deployment protection + holds the long
# connection that a plain public request would drop).
echo "→ Running the pipeline in dry-run mode (1–5 min). Nothing will be published."
RESP_FILE="$(mktemp)"; trap 'rm -f "$RESP_FILE"' EXIT
vercel curl /api/generate-post --deployment "$PROD" --cwd "$LINK" -- \
  --request POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "x-dry-run: 1" \
  --max-time 305 -s -o "$RESP_FILE" 2>/dev/null || true

python3 - "$RESP_FILE" <<'PY'
import sys, json
raw = open(sys.argv[1]).read().strip() if len(sys.argv) > 1 else ""
if not raw:
    sys.stderr.write("✗ No response — the run timed out. The pipeline occasionally takes the\n"
                     "  full ~5 min (when the writer retries for SEO). Just run it again.\n")
    raise SystemExit(1)
try:
    d = json.loads(raw)
except Exception:
    sys.stderr.write("✗ Unexpected response (not JSON):\n" + raw[:400] + "\n")
    raise SystemExit(1)
if d.get("error"):
    print("✗ Pipeline error:", d["error"]); raise SystemExit(1)
p = d.get("post", {})
bar = "=" * 72
print("\n" + bar)
print("DRY RUN — nothing was published to the live blog" if d.get("dryRun")
      else "⚠ WARNING: dryRun is FALSE — this may have published! Check the blog.")
print(bar)
print("TITLE    :", p.get("title"))
print("AUTHOR   :", p.get("author"))
print("SEO/READ :", p.get("seoScore"), "/", p.get("readabilityScore"),
      "  published:", d.get("published"))
print("\n--- BODY (first 1800 chars) ---\n")
print((p.get("body") or "")[:1800])
print("\n" + bar)
print("Looks good? The real post auto-publishes on the Mon/Wed/Fri 08:00 UTC schedule.")
print(bar)
PY
