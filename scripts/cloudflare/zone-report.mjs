#!/usr/bin/env node

import {
  inferEmailRoutingState,
  listDnsRecords,
  printHeading,
  printKeyValue,
  resolveZone,
  tryCfResult,
  unique
} from "./_lib.mjs";

const { zone, zoneId, zoneName, accountId, accountName, baseUrl } = await resolveZone();
const dnsRecords = await listDnsRecords(zoneId);
const proxiedRecords = dnsRecords.filter((record) => record.proxied);
const nameServers = zone.name_servers?.length
  ? zone.name_servers
  : zone.vanity_name_servers?.length
    ? zone.vanity_name_servers
    : [];
const recordTypes = Object.entries(
  dnsRecords.reduce((accumulator, record) => {
    accumulator[record.type] = (accumulator[record.type] ?? 0) + 1;
    return accumulator;
  }, {})
).sort((left, right) => left[0].localeCompare(right[0]));

const emailRouting = await tryCfResult(`/zones/${zoneId}/email/routing`);
const keyRecords = dnsRecords.filter((record) => {
  return (
    record.name === zoneName ||
    record.name === `www.${zoneName}` ||
    record.type === "MX" ||
    record.type === "TXT"
  );
});

printHeading("BSF Cloudflare Zone");
printKeyValue("Zone", zoneName);
printKeyValue("Base URL", baseUrl);
printKeyValue("Zone ID", zoneId);
printKeyValue("Account", `${accountName} (${accountId || "unknown"})`);
printKeyValue("Status", zone.status || "unknown");
printKeyValue("Paused", String(Boolean(zone.paused)));
printKeyValue("Nameservers", nameServers.length ? nameServers.join(", ") : "none returned");
printKeyValue(
  "Email routing",
  emailRouting.ok ? inferEmailRoutingState(emailRouting.result) : `unknown (${emailRouting.error.message})`
);

printHeading("DNS Summary");
printKeyValue("Total records", dnsRecords.length);
printKeyValue("Proxied records", proxiedRecords.length);
printKeyValue(
  "Record types",
  recordTypes.length
    ? recordTypes.map(([type, count]) => `${type}:${count}`).join(", ")
    : "none"
);
printKeyValue(
  "Proxied hostnames",
  proxiedRecords.length
    ? unique(proxiedRecords.map((record) => record.name)).sort().join(", ")
    : "none"
);

printHeading("Key Records");
if (!keyRecords.length) {
  console.log("No apex/www/MX/TXT records found.");
} else {
  for (const record of keyRecords) {
    const details = [record.type, record.name, String(record.content)];
    if (typeof record.proxied === "boolean") {
      details.push(`proxied=${record.proxied}`);
    }
    if (record.ttl) {
      details.push(`ttl=${record.ttl}`);
    }
    console.log(`- ${details.join(" | ")}`);
  }
}
