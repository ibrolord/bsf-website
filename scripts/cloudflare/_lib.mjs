import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const API_BASE = "https://api.cloudflare.com/client/v4";

export const DEFAULT_ZONE_NAME = "thebigsisterfoundation.org";
export const DEFAULT_BASE_URL = `https://${DEFAULT_ZONE_NAME}`;
export const DEFAULT_PURGE_PATHS = [
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

export const EXPECTED_CACHE_RULES = [
  {
    title: "Static asset cache rule",
    summary: "Cache first-party /assets/* and /fonts/* with long-lived immutable origin headers.",
    source: "/assets/(.*) and /fonts/(.*)",
    cacheControl: "public, max-age=31536000, immutable"
  },
  {
    title: "Shared shell asset rule",
    summary: "Cache /shared/* while respecting origin revalidation headers.",
    source: "/shared/(.*)",
    cacheControl: "public, max-age=86400, must-revalidate"
  },
  {
    title: "Anonymous HTML cache rule",
    summary: "Dashboard-managed rule for GET HTML on /, /blog/, /volunteer/, and /donate/ with short edge TTL.",
    source: "Cloudflare dashboard cache rule only",
    cacheControl: "Respect origin; Edge TTL 5 minutes"
  }
];

export function getProjectRoot() {
  return PROJECT_ROOT;
}

export function resolveProjectPath(...segments) {
  return path.join(PROJECT_ROOT, ...segments);
}

export async function fileExists(relativePath) {
  try {
    await fs.access(resolveProjectPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function readText(relativePath) {
  return fs.readFile(resolveProjectPath(relativePath), "utf8");
}

export async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function walkFiles(relativeDir, options = {}) {
  const ignore = new Set([".git", ".vercel", "node_modules", ...(options.ignore ?? [])]);
  const absoluteDir = resolveProjectPath(relativeDir);
  const results = [];

  async function visit(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      results.push(entryPath);
    }
  }

  await visit(absoluteDir);
  return results;
}

export function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function printHeading(title) {
  console.log(`\n== ${title} ==`);
}

export function printKeyValue(label, value) {
  console.log(`${label}: ${value}`);
}

export function printCheck(ok, label, details = "") {
  const prefix = ok ? "[pass]" : "[fail]";
  const suffix = details ? ` - ${details}` : "";
  console.log(`${prefix} ${label}${suffix}`);
}

export function unique(items) {
  return [...new Set(items)];
}

export function collectStrings(value, bag = []) {
  if (typeof value === "string") {
    bag.push(value);
    return bag;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, bag);
    }
    return bag;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStrings(nested, bag);
    }
  }

  return bag;
}

export function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function inferEmailRoutingState(settings) {
  if (!settings || typeof settings !== "object") {
    return "unknown";
  }
  if (typeof settings.enabled === "boolean") {
    return settings.enabled ? "enabled" : "disabled";
  }
  if (typeof settings.state === "string" && settings.state) {
    return settings.state;
  }
  if (typeof settings.status === "string" && settings.status) {
    return settings.status;
  }
  if (typeof settings.name === "string" && settings.name) {
    return settings.name;
  }
  return "unknown";
}

export async function loadCloudflareEnv() {
  await loadEnvFile(resolveProjectPath(".env.cloudflare.local"));
  process.env.CLOUDFLARE_ZONE_NAME ||= DEFAULT_ZONE_NAME;
  process.env.BASE_URL ||= DEFAULT_BASE_URL;
}

async function loadEnvFile(filePath) {
  let text;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = stripWrappingQuotes(rawValue.trim());
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function requireEnv(name, explanation) {
  const value = process.env[name];
  if (value) return value;
  const suffix = explanation ? ` ${explanation}` : "";
  throw new Error(
    `Missing ${name}.${suffix} Set it in .env.cloudflare.local or export it in your shell.`
  );
}

export async function cfFetch(apiPath, options = {}) {
  await loadCloudflareEnv();
  const token = requireEnv(
    "CLOUDFLARE_API_TOKEN",
    "These Cloudflare REST commands use API-token auth."
  );

  const url = new URL(`${API_BASE}${apiPath}`);
  const query = options.query ?? {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
      `${response.status} ${response.statusText}`;
    throw new Error(`${options.method ?? "GET"} ${url.pathname} failed: ${message}`);
  }

  return payload;
}

export async function cfResult(apiPath, options = {}) {
  const payload = await cfFetch(apiPath, options);
  return payload.result;
}

export async function cfPaginate(apiPath, options = {}) {
  const perPage = Number(options.perPage ?? 100);
  const query = { ...(options.query ?? {}), per_page: perPage };
  let page = 1;
  const combined = [];

  while (true) {
    const payload = await cfFetch(apiPath, {
      ...options,
      query: { ...query, page }
    });
    const pageItems = Array.isArray(payload.result) ? payload.result : [];
    combined.push(...pageItems);

    const totalPages = Number(payload.result_info?.total_pages ?? 1);
    if (page >= totalPages || pageItems.length === 0) {
      break;
    }
    page += 1;
  }

  return combined;
}

export async function tryCfResult(apiPath, options = {}) {
  try {
    const result = await cfResult(apiPath, options);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function tryCfPaginate(apiPath, options = {}) {
  try {
    const result = await cfPaginate(apiPath, options);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function resolveZone() {
  await loadCloudflareEnv();
  const zoneName = process.env.CLOUDFLARE_ZONE_NAME || DEFAULT_ZONE_NAME;
  const configuredZoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (configuredZoneId) {
    const zone = await cfResult(`/zones/${configuredZoneId}`);
    if (!process.env.CLOUDFLARE_ACCOUNT_ID && zone.account?.id) {
      process.env.CLOUDFLARE_ACCOUNT_ID = zone.account.id;
    }
    return buildZoneContext(zone, zoneName);
  }

  const zones = await cfResult("/zones", {
    query: {
      name: zoneName,
      per_page: 50
    }
  });

  const zone = Array.isArray(zones)
    ? zones.find((candidate) => candidate.name === zoneName) ?? zones[0]
    : null;

  if (!zone) {
    throw new Error(
      `Cloudflare zone ${zoneName} was not found. Verify CLOUDFLARE_ZONE_NAME and CLOUDFLARE_API_TOKEN.`
    );
  }

  process.env.CLOUDFLARE_ZONE_ID = zone.id;
  if (!process.env.CLOUDFLARE_ACCOUNT_ID && zone.account?.id) {
    process.env.CLOUDFLARE_ACCOUNT_ID = zone.account.id;
  }

  return buildZoneContext(zone, zoneName);
}

function buildZoneContext(zone, fallbackName) {
  return {
    zone,
    zoneId: zone.id,
    zoneName: zone.name || fallbackName,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || zone.account?.id || "",
    accountName: zone.account?.name || "unknown",
    baseUrl: process.env.BASE_URL || `https://${zone.name || fallbackName}`
  };
}

export async function listDnsRecords(zoneId) {
  return cfPaginate(`/zones/${zoneId}/dns_records`, {
    query: {
      per_page: 100
    }
  });
}

export async function readEmailRoutingExpectations() {
  const fallback = {
    aliases: [
      `hello@${DEFAULT_ZONE_NAME}`,
      `give@${DEFAULT_ZONE_NAME}`
    ],
    destination: null,
    source: "defaults"
  };

  try {
    const todoText = await readText("public/TODO-BOLAJI.md");
    const match = todoText.match(/Routes:\s*`([^`]+)`\s*\+\s*`([^`]+)`\s*→\s*`([^`]+)`/);
    if (!match) {
      return fallback;
    }
    return {
      aliases: [match[1], match[2]].map(normalizeEmail),
      destination: normalizeEmail(match[3]),
      source: "public/TODO-BOLAJI.md"
    };
  } catch {
    return fallback;
  }
}
