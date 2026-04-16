#!/usr/bin/env node

import {
  DEFAULT_PURGE_PATHS,
  EXPECTED_CACHE_RULES,
  fileExists,
  printCheck,
  printHeading,
  printKeyValue,
  readJson,
  readText
} from "./_lib.mjs";

const vercelConfig = await readJson("public/vercel.json");
const headers = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const docsExists = await fileExists("docs/cloudflare-cache-rules.md");
const purgeShimExists = await fileExists("scripts/purge-cloudflare-cache.mjs");
const purgeNamespacedExists = await fileExists("scripts/cloudflare/purge-cache.mjs");
const cacheDocText = docsExists ? await readText("docs/cloudflare-cache-rules.md") : "";

const headerChecks = [
  {
    source: "/assets/(.*)",
    value: "public, max-age=31536000, immutable"
  },
  {
    source: "/fonts/(.*)",
    value: "public, max-age=31536000, immutable"
  },
  {
    source: "/shared/(.*)",
    value: "public, max-age=86400, must-revalidate"
  }
].map((expected) => {
  const entry = headers.find((header) => header.source === expected.source);
  const actualValue = entry?.headers?.find((header) => header.key === "Cache-Control")?.value;
  return {
    ...expected,
    ok: actualValue === expected.value,
    actualValue
  };
});

printHeading("Cache Rule Inventory");
for (const rule of EXPECTED_CACHE_RULES) {
  console.log(`- ${rule.title}: ${rule.summary}`);
}

printHeading("Local Compliance Checks");
for (const check of headerChecks) {
  printCheck(
    check.ok,
    `Origin header ${check.source}`,
    check.ok ? check.value : `expected "${check.value}", got "${check.actualValue ?? "missing"}"`
  );
}

printCheck(docsExists, "Cache runbook doc exists", "docs/cloudflare-cache-rules.md");
printCheck(
  docsExists && cacheDocText.includes("## 3. Anonymous HTML cache rule"),
  "Dashboard HTML cache rule documented"
);
printCheck(
  docsExists && !cacheDocText.includes("/Users/ibrobaba/TrashShit/claudecode/VNtranscript"),
  "No stale absolute purge path remains in cache docs"
);
printCheck(purgeShimExists, "Legacy purge entrypoint preserved");
printCheck(purgeNamespacedExists, "Namespaced purge script exists");

printHeading("Purge Defaults");
printKeyValue("Hot paths", DEFAULT_PURGE_PATHS.join(", "));
printKeyValue("Deploy boundary", "Vercel production deploy first, Cloudflare purge second");
