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

interface RawEntry {
  uid?: string | number;
  name?: string;
  region?: string;
  note?: string;
  expire_date?: string;
  expiry_date?: string;
  expires_at?: string;
  created_by?: string;
  sync_target?: string;
}

interface Envelope {
  success?: boolean;
  message?: string;
  /** The retired service named its failure field `error`. */
  error?: string;
  count?: number;
  data?: RawEntry | RawEntry[];
  /** The retired service answered the expiry at the top level. */
  expire_date?: string;
}

/** Upstream has settled on `expire_date`; the others are cheap insurance. */
function pickDate(raw: RawEntry | undefined): string {
  return raw?.expire_date ?? raw?.expiry_date ?? raw?.expires_at ?? "";
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
    uid: String(raw.uid ?? ""),
    name: raw.name ?? "",
    // Entries added before the move have no region of their own.
    region: raw.region ?? "ALL SERVER",
    note: raw.note ?? "",
    expireDate: pickDate(raw),
    createdBy: raw.created_by ?? "",
    sync: raw.sync_target ?? "",
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
    name: data?.name ?? "",
    // Not documented on this action, so it is reported when offered and
    // left empty otherwise. Callers must not invent one.
    expireDate: pickDate(data) || payload.expire_date || "",
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
