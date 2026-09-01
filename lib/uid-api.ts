import "server-only";

import { HttpError } from "./auth";
import type { WhitelistEntry } from "./types";

const API_URL = process.env.TX999_API_URL ?? "https://terminalx999.live/api.php";
const API_KEY = process.env.TX999_API_KEY;

export type { WhitelistEntry };

interface RawEntry {
  uid?: string;
  name?: string;
  region?: string;
  expire_date?: string;
  created_by?: string;
  sync_target?: string;
}

interface Envelope {
  success?: boolean;
  /** Upstream names its failure field `error`, not `message`. */
  error?: string;
  message?: string;
  data?: RawEntry[];
  expire_date?: string;
}

/**
 * Single entry point to the TX999 whitelist API.
 *
 * Only three actions exist -- `reseller_add`, `reseller_remove` and
 * `reseller_list`. Anything else answers "Method not allowed" or an
 * empty 200 body, so there is no update, no bulk delete and no way to
 * read a credit balance with the API key alone (`get_my_api_key` wants a
 * username and password, being the login call that hands out the key).
 */
async function call(action: string, params: Record<string, string> = {}): Promise<Envelope> {
  if (!API_KEY) {
    throw new HttpError(500, "UID whitelist API is not configured. Set TX999_API_KEY.");
  }

  const query = new URLSearchParams({ action, api_key: API_KEY, ...params });

  let payload: Envelope;
  try {
    const response = await fetch(`${API_URL}?${query}`, {
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    payload = (await response.json()) as Envelope;
  } catch (err) {
    throw new HttpError(502, `Whitelist API unreachable: ${(err as Error).message}`);
  }

  if (payload.success === false) {
    const reason = payload.error ?? payload.message ?? "The whitelist API refused the request.";
    // A rejected key is a misconfiguration on this side, not something
    // the person clicking the button did wrong -- so it reads as a 500
    // rather than joining "UID already exists" in the 400s.
    throw new HttpError(/invalid api key/i.test(reason) ? 500 : 400, reason);
  }

  return payload;
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const payload = await call("reseller_list");

  return (payload.data ?? []).map((raw) => ({
    uid: String(raw.uid ?? ""),
    name: raw.name ?? "",
    region: raw.region ?? "ALL SERVER",
    expireDate: raw.expire_date ?? "",
    createdBy: raw.created_by ?? "",
    sync: raw.sync_target ?? "",
  }));
}

/**
 * Whitelists a UID and answers the expiry the upstream applied.
 *
 * The name is stored verbatim: nothing upstream checks it against the
 * game, so a typo is saved exactly as typed and a UID that belongs to
 * nobody is accepted just as readily. It is a label for the panel, not
 * a verification.
 */
export async function addWhitelist(uid: string, name: string, days: number): Promise<string> {
  const params: Record<string, string> = { uid, days: String(days) };
  if (name) params.name = name;

  const payload = await call("reseller_add", params);
  return payload.expire_date ?? "";
}

/**
 * Removes a UID.
 *
 * Upstream answers `success: true` whether or not the UID was ever
 * there, so this resolving means "it is gone now", never "it existed".
 * Callers must not report a count of what they deleted from it.
 */
export async function removeWhitelist(uid: string): Promise<void> {
  await call("reseller_remove", { uid });
}
