#!/usr/bin/env node

import path from "node:path";
import {
  fileExists,
  loadCloudflareEnv,
  printHeading,
  printKeyValue,
  readText,
  resolveProjectPath,
  walkFiles
} from "./_lib.mjs";

await loadCloudflareEnv();

const antiSpamPath = "public/shared/bsf-antispam.js";
const antiSpamText = await readText(antiSpamPath);
const apiFiles = await walkFiles("public/api");
const serverFiles = apiFiles.filter((filePath) => filePath.endsWith(".js") || filePath.endsWith(".mjs"));
const serverTextList = await Promise.all(serverFiles.map((filePath) => readText(path.relative(resolveProjectPath(), filePath))));
const serverBlob = serverTextList.join("\n");

const widgetReady = antiSpamText.includes("cf-turnstile") && antiSpamText.includes("turnstileSiteKey");
const defaultDisabled = antiSpamText.includes("turnstileSiteKey: null");
const tokenPresenceOnly = antiSpamText.includes('cf-turnstile-response');
const serverSideValidation =
  serverBlob.includes("siteverify") ||
  serverBlob.includes("TURNSTILE_SECRET_KEY") ||
  serverBlob.includes("challenges.cloudflare.com/turnstile/v0/siteverify");
const siteKeyConfigured = Boolean(process.env.TURNSTILE_SITE_KEY);
const secretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);
const gateOpen = serverSideValidation && siteKeyConfigured && secretConfigured;

printHeading("Turnstile Readiness");
printKeyValue("Client widget support", widgetReady ? "present" : "missing");
printKeyValue("Client default", defaultDisabled ? "disabled by default" : "configured in code");
printKeyValue("Client validation", tokenPresenceOnly ? "token presence check only" : "unknown");
printKeyValue("Server-side Siteverify", serverSideValidation ? "present" : "missing");
printKeyValue("TURNSTILE_SITE_KEY", siteKeyConfigured ? "set" : "unset");
printKeyValue("TURNSTILE_SECRET_KEY", secretConfigured ? "set" : "unset");
printKeyValue("Gate", gateOpen ? "eligible to enable after verification" : "blocked");

if (!serverSideValidation) {
  console.log(
    "Turnstile remains blocked because the repo does not contain a server-side Siteverify implementation."
  );
}

if (!defaultDisabled && (await fileExists(antiSpamPath))) {
  console.log("Review BSFAntiSpam defaults before enabling production Turnstile.");
}
