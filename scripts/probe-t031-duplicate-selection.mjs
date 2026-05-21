#!/usr/bin/env node
// CCO-T031: probe the duplicate-aware Contact selection rules from
// src/actions/password-reset.ts findContactByEmail.
//
// Doesn't touch Podio — inlines the selection rules against synthetic
// items so we can exercise every branch deterministically.
//
// Run: node scripts/probe-t031-duplicate-selection.mjs

const DUP = {
  CONFIRMED_DUPLICATE: 1,
  ACTIVE: 3,
  SUSPECTED_DUPLICATE: 4,
  CHECK_NOW: 5,
  NOT_CHECKED: 6,
  NO_EMAIL_ADDRESS_TO_CHECK: 7,
};

function select(items) {
  const DISQUALIFIED = new Set([DUP.SUSPECTED_DUPLICATE, DUP.CONFIRMED_DUPLICATE]);
  const eligible = items.filter(
    (it) => it.statusId === null || !DISQUALIFIED.has(it.statusId)
  );
  if (eligible.length === 0) return null;
  const actives = eligible.filter((it) => it.statusId === DUP.ACTIVE);
  return actives[0]?.podioItemId ?? eligible[0].podioItemId;
}

let failed = 0;
function check(name, got, want) {
  if (got === want) console.log(`  ok   ${name}`);
  else {
    console.error(`  FAIL ${name}  got=${got} want=${want}`);
    failed += 1;
  }
}

console.log("=== no matches ===");
check("empty list", select([]), null);

console.log("=== single match ===");
check("single ACTIVE",
  select([{ podioItemId: 100, statusId: DUP.ACTIVE }]), 100);
check("single NOT_CHECKED",
  select([{ podioItemId: 101, statusId: DUP.NOT_CHECKED }]), 101);
check("single CHECK_NOW",
  select([{ podioItemId: 102, statusId: DUP.CHECK_NOW }]), 102);
check("single SUSPECTED → null",
  select([{ podioItemId: 103, statusId: DUP.SUSPECTED_DUPLICATE }]), null);
check("single CONFIRMED → null",
  select([{ podioItemId: 104, statusId: DUP.CONFIRMED_DUPLICATE }]), null);
check("single with null status",
  select([{ podioItemId: 105, statusId: null }]), 105);

console.log("=== duplicates ===");
check("ACTIVE + SUSPECTED → ACTIVE wins",
  select([
    { podioItemId: 200, statusId: DUP.SUSPECTED_DUPLICATE },
    { podioItemId: 201, statusId: DUP.ACTIVE },
  ]), 201);
check("CONFIRMED + ACTIVE → ACTIVE wins (order swapped)",
  select([
    { podioItemId: 210, statusId: DUP.CONFIRMED_DUPLICATE },
    { podioItemId: 211, statusId: DUP.ACTIVE },
  ]), 211);
check("ACTIVE + CONFIRMED → ACTIVE wins (ACTIVE first)",
  select([
    { podioItemId: 220, statusId: DUP.ACTIVE },
    { podioItemId: 221, statusId: DUP.CONFIRMED_DUPLICATE },
  ]), 220);
check("two SUSPECTED → null",
  select([
    { podioItemId: 230, statusId: DUP.SUSPECTED_DUPLICATE },
    { podioItemId: 231, statusId: DUP.SUSPECTED_DUPLICATE },
  ]), null);
check("SUSPECTED + NOT_CHECKED → NOT_CHECKED wins",
  select([
    { podioItemId: 240, statusId: DUP.SUSPECTED_DUPLICATE },
    { podioItemId: 241, statusId: DUP.NOT_CHECKED },
  ]), 241);
check("NOT_CHECKED + CHECK_NOW (both eligible, no ACTIVE) → first eligible",
  select([
    { podioItemId: 250, statusId: DUP.NOT_CHECKED },
    { podioItemId: 251, statusId: DUP.CHECK_NOW },
  ]), 250);
check("two ACTIVE → first ACTIVE",
  select([
    { podioItemId: 260, statusId: DUP.ACTIVE },
    { podioItemId: 261, statusId: DUP.ACTIVE },
  ]), 260);
check("realistic: ACTIVE + SUSPECTED + CONFIRMED → ACTIVE",
  select([
    { podioItemId: 300, statusId: DUP.SUSPECTED_DUPLICATE },
    { podioItemId: 301, statusId: DUP.ACTIVE },
    { podioItemId: 302, statusId: DUP.CONFIRMED_DUPLICATE },
  ]), 301);

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll duplicate-selection probe checks passed.");
