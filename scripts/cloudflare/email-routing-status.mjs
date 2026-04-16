#!/usr/bin/env node

import {
  collectStrings,
  inferEmailRoutingState,
  looksLikeEmail,
  normalizeEmail,
  printHeading,
  printKeyValue,
  readEmailRoutingExpectations,
  resolveZone,
  tryCfPaginate,
  tryCfResult,
  unique
} from "./_lib.mjs";

const expectations = await readEmailRoutingExpectations();
const { zoneId, zoneName, accountId } = await resolveZone();

const settingsResult = await tryCfResult(`/zones/${zoneId}/email/routing`);
const rulesResult = await tryCfPaginate(`/zones/${zoneId}/email/routing/rules`);
const addressAttempts = [
  accountId ? `/accounts/${accountId}/email/routing/addresses` : null,
  `/zones/${zoneId}/email/routing/addresses`
].filter(Boolean);

let addressSource = "unavailable";
let addresses = [];
let addressError = null;

for (const apiPath of addressAttempts) {
  const attempt = await tryCfPaginate(apiPath);
  if (attempt.ok) {
    addressSource = apiPath;
    addresses = attempt.result;
    addressError = null;
    break;
  }
  addressError = attempt.error;
}

const addressLookup = new Map();
for (const address of addresses) {
  const candidates = unique(
    collectStrings(address).filter((value) => looksLikeEmail(value)).map(normalizeEmail)
  );
  for (const candidate of candidates) {
    addressLookup.set(candidate, candidate);
  }
  if (address?.id && candidates[0]) {
    addressLookup.set(String(address.id), candidates[0]);
  }
}

const rules = rulesResult.ok ? rulesResult.result : [];
const routingState = settingsResult.ok
  ? inferEmailRoutingState(settingsResult.result)
  : `unknown (${settingsResult.error.message})`;
const verifiedDestinations = unique([...addressLookup.values()]).sort();

printHeading("BSF Email Routing");
printKeyValue("Zone", zoneName);
printKeyValue("Routing state", routingState);
printKeyValue("Rules discovered", rules.length);
printKeyValue("Verified destinations", verifiedDestinations.length ? verifiedDestinations.join(", ") : "none");
printKeyValue("Address source", addressSource);

if (addressError) {
  printKeyValue("Address lookup warning", addressError.message);
}

printHeading("Expected Aliases");
for (const alias of expectations.aliases) {
  const normalizedAlias = normalizeEmail(alias);
  const matchingRules = rules.filter((rule) => {
    return collectStrings(rule).some((value) => normalizeEmail(value) === normalizedAlias);
  });

  if (!matchingRules.length) {
    console.log(`- ${normalizedAlias}: missing`);
    continue;
  }

  const destinations = unique(
    matchingRules
      .flatMap((rule) => collectStrings(rule.actions ?? rule))
      .map((value) => addressLookup.get(String(value)) ?? value)
      .filter((value) => looksLikeEmail(value))
      .map(normalizeEmail)
  );

  const destinationSummary = destinations.length ? destinations.join(", ") : "no destination parsed";
  const expectedDestination = expectations.destination;
  const matchesExpected = expectedDestination
    ? destinations.some((value) => value === expectedDestination)
    : destinations.length > 0;
  const verdict = matchesExpected ? "ok" : "check";
  console.log(`- ${normalizedAlias}: ${verdict} -> ${destinationSummary}`);
}

if (expectations.destination) {
  printKeyValue("Expected destination", `${expectations.destination} (${expectations.source})`);
}
