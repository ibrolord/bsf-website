#!/usr/bin/env node

import {
  DEFAULT_PURGE_PATHS,
  cfResult,
  printHeading,
  printKeyValue,
  resolveZone
} from "./_lib.mjs";

const { zoneId, zoneName, baseUrl } = await resolveZone();
const requestedPaths = process.argv.slice(2);
const selectedPaths = requestedPaths.length ? requestedPaths : DEFAULT_PURGE_PATHS;
const urls = [...new Set(selectedPaths.map((value) => {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, baseUrl).toString();
  }
}))];

await cfResult(`/zones/${zoneId}/purge_cache`, {
  method: "POST",
  body: {
    files: urls
  }
});

printHeading("Cloudflare Purge Complete");
printKeyValue("Zone", zoneName);
printKeyValue("Purged URLs", urls.length);
for (const url of urls) {
  console.log(`- ${url}`);
}
