/**
 * Input rules for Florida personalized plates, applied locally so that
 * unorderable configurations never reach FLHSMV.
 *
 * Deliberately narrow: only the constraints the live form actually enforces.
 * A documented "numerals-only plates are limited to 1-999" rule was removed
 * after 8347 and 7291 both came back AVAILABLE, which means the cap is not real
 * and enforcing it here discarded orderable candidates.
 */

/** The live form sets maxlength="7" on every input; a space or hyphen counts toward it. */
export const MAX_LENGTH = 7;

const ALLOWED = /^[A-Z0-9 -]+$/;

export type Normalized =
  | { ok: true; input: string; plate: string }
  | { ok: false; input: string; reason: string };

export function normalizePlate(raw: string): Normalized {
  const input = raw.trim();
  if (input === "") return { ok: false, input: raw, reason: "empty" };

  // Florida does not manufacture plates with the letter O; the system renders it
  // as a zero. Folding it here keeps O and 0 spellings from being checked twice.
  const plate = input.toUpperCase().replace(/O/g, "0");

  if (plate.length > MAX_LENGTH) {
    return { ok: false, input, reason: `${plate.length} characters, max is ${MAX_LENGTH}` };
  }

  if (!ALLOWED.test(plate)) {
    const bad = [...new Set(plate.split(""))].filter((c) => !/[A-Z0-9 -]/.test(c));
    return { ok: false, input, reason: `illegal character(s): ${bad.join(" ")}` };
  }

  return { ok: true, input, plate };
}
