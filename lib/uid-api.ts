import "server-only";

import { HttpError } from "./auth";
import { DEFAULT_WHITELIST_REGION } from "./packages";
import type { WhitelistEntry } from "./types";

/**
 * The whitelist moved onto the licence API's endpoint.
 *
 * It used to be a service of its own: `terminalx999.live/api.php`, a GET
 * with query parameters, its own reseller key, its own `reseller_*`
 * actions. That host no longer resolves. The whitelist is now three
 * actions on `api_admin.php` -- the same JSON POST endpoint, and the same
 * admin credential, that `lib/license-api.ts` already uses.
 *
 * So `TX999_*` fall back to `LICENSE_*` instead of asking for a second
 * copy of one key. They stay overridable only in case the provider splits
 * the two apart again; deployments should leave them unset. A deployment
 * that still has the retired reseller key in `TX999_API_KEY` is the one
 * failure this cannot paper over -- it wins over the fallback and is
 * rejected, which `call` says out loud.
 */
const API_URL =
  process.env.TX999_API_URL ??
  process.env.LICENSE_API_URL ??
  "https://auth.terminalx999.online/api_admin.php";
const API_KEY = process.env.TX999_API_KEY ?? process.env.LICENSE_API_KEY;

/**
 * Forces UID Bypass into maintenance, whatever the provider says.
 *
 * The service can be down while its API still answers: the provider's
 * own panel shows "UID Whitelist Service Under Maintenance" against an
 * endpoint that returns success and an empty list. So an unreachable
 * host is not the only way this breaks, and an unreachable host is the
 * only way the panel could otherwise tell.
 *
 * Set UID_BYPASS_MAINTENANCE to 1 for that case. It stops the write
 * paths too -- an add during maintenance is a credit spent on nothing.
 */
export const MAINTENANCE = /^(1|true|on|yes)$/i.test(
  process.env.UID_BYPASS_MAINTENANCE ?? "",
);

export type { WhitelistEntry };

export interface WhitelistAddResult {
  /** The in-game name the provider read off the UID. */
  name: string;
  /** "YYYY-MM-DD", or "" when the provider reports no date. */
  expireDate: string;
}

/**
 * One record as the endpoint actually sends it, confirmed against a
 * live row rather than assumed:
 *
 *   id "uid_58f6f80ba2f7"   uid "1278430378"   name "<in-game name>"
 *   region "IND"   created_at 1790098182   expires_at 1792690182
 *   days 30   note ""   created_by "CHEAT EXE"   status "active"
 *   synced true   last_login ""   last_ip ""
 *
 * The dates are the trap. `expires_at` is a unix timestamp in seconds,
 * where the retired service sent `expire_date` as a "YYYY-MM-DD"
 * string -- and nothing downstream survives being handed a number where
 * it expects a date string. The older spellings are still read so a
 * record written before the move still lands.
 */
interface RawEntry {
  id?: string;
  uid?: string | number;
  name?: string;
  region?: string;
  note?: string;
  days?: number;
  status?: string;
  created_at?: number | string;
  created_by?: string;
  expires_at?: number | string;
  expire_date?: number | string;
  expiry_date?: number | string;
}

interface Envelope {
  success?: boolean;
  message?: string;
  /** The retired service named its failure field `error`. */
  error?: string;
  count?: number;
  data?: RawEntry | RawEntry[];
  /** Some actions answer the expiry at the top level instead. */
  expires_at?: number | string;
  expire_date?: number | string;
}

/** Nothing upstream is trusted to be a string, so nothing is assumed to be. */
function text(value: unknown): string {
  return value == null ? "" : String(value);
}

/**
 * Normalises whatever the provider called a date into "YYYY-MM-DD".
 *
 * It sends unix seconds. Milliseconds are accepted too rather than
 * silently rendering a date in the year 58000, and a date string is
 * passed through so a pre-move record still reads. Anything else is
 * "" -- an empty expiry displays as a dash, where a bad one throws.
 */
function toDay(value: unknown): string {
  const raw = text(value).trim();
  if (raw === "") return "";

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "";
    // Seconds unless it is plainly milliseconds: a seconds value this
    // side of the year 5138 never reaches 1e11.
    const at = new Date(n > 1e11 ? n : n * 1000);
    return Number.isNaN(at.getTime()) ? "" : at.toISOString().slice(0, 10);
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : "";
}

function pickDate(raw: RawEntry | undefined): string {
  return toDay(raw?.expires_at ?? raw?.expire_date ?? raw?.expiry_date);
}

/**
 * Single entry point to the TX999 whitelist.
 *
 * Three actions exist -- `whitelist_uid`, `remove_uid` and
 * `get_whitelisted_uids`. Anything else is refused with the endpoint's
 * full action list, which is shared with the licence API: the key that
 * whitelists a UID can also mint and delete licence keys, so nothing
 * here builds an action name from anything a caller supplies.
 */
async function call(
  action: string,
  params: Record<string, string | number> = {},
): Promise<Envelope> {
  if (!API_KEY) {
    throw new HttpError(
      500,
      "UID whitelist API is not configured. Set LICENSE_API_KEY (or TX999_API_KEY).",
    );
  }

  let payload: Envelope;
  let status: number;
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: API_KEY, action, ...params }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    status = response.status;
    payload = (await response.json()) as Envelope;
  } catch (err) {
    throw new HttpError(502, `Whitelist API unreachable: ${(err as Error).message}`);
  }

  // `success` alone decides. This endpoint fills `message` on the way
  // out too -- "Whitelisted UIDs retrieved successfully." -- so reading
  // it the way the retired service's `error` was read would turn every
  // good reply into a failure.
  if (payload.success === false) {
    const reason = payload.message ?? payload.error ?? "The whitelist API refused the request.";

    // A rejected key is a misconfiguration on this side, not something
    // the person clicking the button did wrong -- so it reads as a 500
    // rather than joining "UID already whitelisted" in the 400s. The
    // likeliest cause by far is a deployment still holding the retired
    // reseller key, so the message says where to look.
    if (status === 401 || /invalid or inactive api_key|invalid api.?key/i.test(reason)) {
      throw new HttpError(
        500,
        `${reason} If TX999_API_KEY is set, it may still hold the retired reseller key -- the whitelist uses the admin key now.`,
      );
    }

    throw new HttpError(status === 404 ? 404 : 400, reason);
  }

  return payload;
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const payload = await call("get_whitelisted_uids");
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows.map((raw) => ({
    uid: text(raw.uid),
    name: text(raw.name),
    // Entries added before the move have no region of their own.
    region: text(raw.region) || "ALL SERVER",
    note: text(raw.note),
    expireDate: pickDate(raw),
    createdBy: text(raw.created_by),
  }));
}

/**
 * Whitelists a UID and answers what the provider made of it.
 *
 * The provider verifies the UID against the game and answers with the
 * player's real in-game name, so an unknown UID is refused here rather
 * than stored under whatever was typed -- the reverse of the retired
 * service, which took any name for any number. `note` is the operator's
 * own label and is the only free text left.
 */
export async function addWhitelist(input: {
  uid: string;
  region: string;
  days: number;
  note: string;
}): Promise<WhitelistAddResult> {
  const payload = await call("whitelist_uid", {
    uid: input.uid,
    region: input.region || DEFAULT_WHITELIST_REGION,
    days: input.days,
    note: input.note,
  });

  const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;

  return {
    name: text(data?.name),
    // Not documented on this action, so it is reported when offered and
    // left empty otherwise. Callers must not invent one.
    expireDate: pickDate(data) || toDay(payload.expires_at ?? payload.expire_date),
  };
}

/**
 * Removes a UID, answering whether it was there to remove.
 *
 * The provider now distinguishes the two: a UID it does not hold comes
 * back 404, "UID '...' is not present in whitelist". The retired service
 * reported success either way. That 404 is not treated as an error --
 * the caller asked for the UID to be off the list and it is off the
 * list -- but it is reported, because a bulk delete that quietly counts
 * absent UIDs as removals is how a stale list stays believed.
 */
export async function removeWhitelist(uid: string): Promise<boolean> {
  try {
    await call("remove_uid", { uid });
    return true;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return false;
    throw err;
  }
}
