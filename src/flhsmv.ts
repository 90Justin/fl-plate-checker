/**
 * The FLHSMV personalized plate check form.
 *
 * A plain ASP.NET WebForms page: every submit posts __VIEWSTATE,
 * __VIEWSTATEGENERATOR and __EVENTVALIDATION back, and each response carries
 * the tokens for the next submit. So after the opening GET, a run costs one
 * request per batch.
 */

const ENDPOINT = "https://services.flhsmv.gov/MVCheckPersonalPlate/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** The form exposes exactly five plate inputs per submit. */
export const BATCH_SIZE = 5;

const ROWS = ["One", "Two", "Three", "Four", "Five"] as const;
const TOKENS = ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"] as const;

export type Status = "AVAILABLE" | "NOT AVAILABLE" | "UNKNOWN";

/** The service answered with something other than the form. */
export class FormError extends Error {}

export class PlateForm {
  #cookies = new Map<string, string>();
  #tokens: Record<string, string> | null = null;

  /** Submit up to five normalized plates and read their verdicts. */
  async check(plates: string[]): Promise<Map<string, Status>> {
    if (plates.length === 0 || plates.length > BATCH_SIZE) {
      throw new RangeError(`check takes 1-${BATCH_SIZE} plates, got ${plates.length}`);
    }

    this.#tokens ??= readTokens(await this.#request());

    const form = new URLSearchParams({
      ...this.#tokens,
      "ctl00$MainContent$btnSubmit": "Submit",
    });
    for (const [i, row] of ROWS.entries()) {
      form.set(`ctl00$MainContent$txtInputRow${row}`, plates[i] ?? "");
    }

    const html = await this.#request(form);
    // Keep the chain going, but never let a parse failure hide a good verdict.
    try {
      this.#tokens = readTokens(html);
    } catch {
      this.#tokens = null;
    }

    const results = new Map<string, Status>();
    for (const [i, plate] of plates.entries()) {
      results.set(plate, verdict(html, ROWS[i]!));
    }
    if ([...results.values()].every((s) => s === "UNKNOWN")) {
      this.#tokens = null;
      throw new FormError(`no verdicts in the response for ${plates.join(", ")}`);
    }
    return results;
  }

  /** Drop the chained tokens so the next check reloads the form. */
  reset(): void {
    this.#tokens = null;
  }

  async #request(form?: URLSearchParams): Promise<string> {
    const headers: Record<string, string> = { "user-agent": USER_AGENT };
    if (this.#cookies.size > 0) {
      headers.cookie = [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    if (form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      headers.referer = ENDPOINT;
    }

    const res = await fetch(ENDPOINT, form ? { method: "POST", headers, body: form } : { headers });
    for (const raw of res.headers.getSetCookie()) {
      const [name, ...rest] = (raw.split(";", 1)[0] ?? "").split("=");
      if (name && rest.length > 0) this.#cookies.set(name.trim(), rest.join("=").trim());
    }
    if (!res.ok) throw new FormError(`FLHSMV returned HTTP ${res.status}`);
    return res.text();
  }
}

function readTokens(html: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const name of TOKENS) {
    const match = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`, "i"));
    if (!match) throw new FormError(`${name} missing — the page changed or was blocked`);
    tokens[name] = match[1]!;
  }
  return tokens;
}

function verdict(html: string, row: string): Status {
  // The live page cases these ids inconsistently: lblOutPutRowOne and
  // lblOutPutRowTwo, but lblOutputRowThree/Four/Five. Match case-insensitively.
  const match = html.match(
    new RegExp(`id="MainContent_lblOutputRow${row}"[^>]*>([\\s\\S]*?)</span>`, "i"),
  );
  const text = match?.[1]?.replace(/&nbsp;/gi, " ").replace(/<[^>]*>/g, "").trim();
  return text === "AVAILABLE" || text === "NOT AVAILABLE" ? text : "UNKNOWN";
}
