#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  getProjectRoot,
  listDnsRecords,
  printHeading,
  printKeyValue,
  resolveZone,
  timestampSlug
} from "./_lib.mjs";

const requestedOutput = process.argv[2];
const { zoneId, zoneName, accountId } = await resolveZone();
const dnsRecords = await listDnsRecords(zoneId);
const defaultOutput = path.join(
  getProjectRoot(),
  "artifacts",
  "cloudflare",
  "dns",
  `${timestampSlug()}-${zoneName}.json`
);
const outputPath = requestedOutput ? path.resolve(process.cwd(), requestedOutput) : defaultOutput;

await ensureDir(path.dirname(outputPath));

const payload = {
  exportedAt: new Date().toISOString(),
  zoneName,
  zoneId,
  accountId,
  recordCount: dnsRecords.length,
  records: dnsRecords
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

printHeading("DNS Export Complete");
printKeyValue("Zone", zoneName);
printKeyValue("Record count", dnsRecords.length);
printKeyValue("Saved to", outputPath);
