#!/usr/bin/env node

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const baseUrl = process.env.BASE_URL || "https://thebigsisterfoundation.org";

if (!token || !zoneId) {
  console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID.");
  process.exit(1);
}

const defaultPaths = [
  "/",
  "/blog/",
  "/volunteer/",
  "/donate/",
  "/feed.xml",
  "/sitemap.xml",
  "/api/posts",
  "/api/feed",
  "/api/sitemap"
];

const requested = process.argv.slice(2);
const urls = [...new Set((requested.length ? requested : defaultPaths).map((value) => {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, baseUrl).toString();
  }
}))];

const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    files: urls
  })
});

const payload = await response.json();

if (!response.ok || !payload.success) {
  console.error("Cloudflare purge failed.");
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(`Purged ${urls.length} URL(s).`);
urls.forEach((url) => console.log(`- ${url}`));
