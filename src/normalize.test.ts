import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlate, MAX_LENGTH } from "./normalize.ts";

function ok(raw: string): string {
  const r = normalizePlate(raw);
  assert.equal(r.ok, true, `expected ${raw} to be valid, got: ${r.ok ? "" : r.reason}`);
  return r.ok ? r.plate : "";
}

function rejected(raw: string): string {
  const r = normalizePlate(raw);
  assert.equal(r.ok, false, `expected ${raw} to be rejected`);
  return r.ok ? "" : r.reason;
}

test("uppercases and trims", () => {
  assert.equal(ok("  wrks4me "), "WRKS4ME");
});

test("converts O to 0 because Florida does not manufacture the letter O", () => {
  assert.equal(ok("GATOR"), "GAT0R");
  assert.equal(ok("nOrEprO"), "N0REPR0");
});

test("keeps spaces and hyphens", () => {
  assert.equal(ok("ITS DNS"), "ITS DNS");
  assert.equal(ok("GIT-GUD"), "GIT-GUD");
});

test("accepts a full-length plate", () => {
  assert.equal(ok("SUNBURN").length, MAX_LENGTH);
});

test("rejects anything longer than the form allows", () => {
  assert.match(rejected("TOOLONG1"), /max is 7/);
});

test("counts a space toward the limit", () => {
  assert.match(rejected("SUDO RMX"), /max is 7/);
});

test("rejects punctuation and names the offending characters", () => {
  assert.match(rejected("0X1F600!"), /max is 7/);
  assert.match(rejected("W0NT.FX"), /illegal character/);
  assert.match(rejected("A_B"), /illegal character.*_/);
});

test("rejects empty input", () => {
  assert.match(rejected("   "), /empty/);
});

// The handoff claimed numerals-only plates were capped at 1-999. Testing 8347
// and 7291 against the live form returned AVAILABLE for both, so the cap does
// not exist and enforcing it silently discarded orderable candidates.
test("allows numerals-only plates of any length", () => {
  assert.equal(ok("8347"), "8347");
  assert.equal(ok("1001010"), "1001010");
  assert.equal(ok("999"), "999");
  assert.equal(ok("007"), "007");
});

test("a plate with letters is not subject to the numerals-only range", () => {
  assert.equal(ok("0XBAD"), "0XBAD");
});
