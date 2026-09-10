#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

import { BATCH_SIZE, FormError, PlateForm, type Status } from "./flhsmv.ts";
import { normalizePlate } from "./normalize.ts";

const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

const { values } = parseArgs({
  options: {
    plates: { type: "string" },
    file: { type: "string", default: "plates.txt" },
    out: { type: "string", default: "available.txt" },
    delay: { type: "string", default: "2500" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(
    [
      "Usage: npm run check -- [options]",
      "",
      "  --plates 'A,B,C'  check these instead of reading a file",
      "  --file <path>     one candidate per line (default: plates.txt)",
      "  --out <path>      where to write available plates (default: available.txt)",
      "  --delay <ms>      pause between batches (default: 2500)",
      "  --json            print JSON instead of a table",
    ].join("\n"),
  );
  process.exit(0);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const delayMs = Number(values.delay);
if (!Number.isFinite(delayMs) || delayMs < 0) fail(`--delay must be a number, got ${values.delay}`);

function readCandidates(): string[] {
  if (values.plates !== undefined) return values.plates.split(",");
  try {
    return readFileSync(values.file!, "utf8").split("\n").map((line) => line.split("#")[0]!);
  } catch {
    return fail(`Could not read ${values.file}. Pass --plates 'A,B,C' or create the file.`);
  }
}

type Row = { plate: string; status: Status | "INVALID"; note: string };

// Validate up front so nothing unorderable reaches the service, and fold
// duplicates that differ only by case or by O-versus-zero spelling.
const rows: Row[] = [];
const byPlate = new Map<string, Row>();

for (const candidate of readCandidates()) {
  const input = candidate.trim();
  if (input === "") continue;
  const result = normalizePlate(input);
  if (!result.ok) {
    rows.push({ plate: input, status: "INVALID", note: result.reason });
    continue;
  }
  if (byPlate.has(result.plate)) continue;
  const row: Row = {
    plate: result.plate,
    status: "UNKNOWN",
    note: result.plate === input.toUpperCase() ? "" : `from "${input}"`,
  };
  byPlate.set(result.plate, row);
  rows.push(row);
}

const invalid = rows.filter((r) => r.status === "INVALID");
for (const row of invalid) console.error(`skipped ${row.plate}: ${row.note}`);

const queue = [...byPlate.keys()];
if (queue.length === 0) fail("No candidate plates to check.");

const form = new PlateForm();
console.error(`Checking ${queue.length} plate(s), ${BATCH_SIZE} per request...`);

for (let start = 0; start < queue.length; start += BATCH_SIZE) {
  if (start > 0) await sleep(delayMs);
  const batch = queue.slice(start, start + BATCH_SIZE);

  for (let attempt = 0; ; attempt += 1) {
    try {
      for (const [plate, status] of await form.check(batch)) {
        byPlate.get(plate)!.status = status;
      }
      break;
    } catch (error) {
      if (!(error instanceof FormError) || attempt >= RETRY_DELAYS_MS.length) throw error;
      console.error(`  ${(error as Error).message} — retrying`);
      form.reset();
      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  const done = Math.min(start + BATCH_SIZE, queue.length);
  console.error(`  ${done}/${queue.length}  ${batch.join(" ")}`);
}

const available = rows.filter((r) => r.status === "AVAILABLE").map((r) => r.plate);
writeFileSync(values.out!, available.map((plate) => `${plate}\n`).join(""));

if (values.json) console.log(JSON.stringify(rows, null, 2));
else console.table(rows);

console.error(`\n${available.length} available. Wrote ${values.out}.`);
console.error("Informational only — the county tax collector runs the binding check.");
