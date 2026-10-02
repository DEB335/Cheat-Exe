import "server-only";

import { HttpError } from "./auth";
import { PACKAGE_NAMES } from "./packages";

/**
 * The provider's admin endpoint, moved off `auth.terminalx999.online`.
 *
 * That host now answers 404, so a deployment still configured with it
 * gets the new one rather than a panel where every call fails. Any
 * other value set in the environment wins.
 */
export const DEFAULT_API_URL = "https://prtvshow.online/api_admin.php";
const RETIRED_API_HOST = "auth.terminalx999.online";

export function resolveApiUrl(configured: string | undefined): string {
  const url = configured?.trim();
  return !url || url.includes(RETIRED_API_HOST) ? DEFAULT_API_URL : url;
}

const API_URL = resolveApiUrl(process.env.LICENSE_API_URL);
const API_KEY = process.env.LICENSE_API_KEY;
const APP_ID = process.env.LICENSE_APP_ID;

/**
 * Every response from api_admin.php shares this envelope. `signature` is
 * a sha256 the upstream attaches; we pass it through but cannot verify
 * it without the signing scheme from the provider.
 */
export interface LicenseEnvelope {
  success?: boolean;
  message?: string;
  timestamp?: number;
  signature?: string;
}

export interface PackagesResponse extends LicenseEnvelope {
  packages?: Array<{
    app_id: string;
    app_name: string;
    package_id: string;
    package_name: string;
    display_name: string;
  }>;
  linked_admin?: string;
}

export interface StatsResponse extends LicenseEnvelope {
  username?: string;
  total_keys?: number;
  active_keys?: number;
  banned_keys?: number;
  used_keys?: number;
  key_limit?: number;
  keys_created?: number;
  remaining?: number;
}

export interface KeyInfoResponse extends LicenseEnvelope {
  key?: string;
  app_name?: string;
  package_name?: string;
  status?: string;
  created_at?: string;
  expiry_date?: string;
  hwid?: string;
  ip?: string;
  duration_days?: number;
}

export interface GenerateResponse extends LicenseEnvelope {
  app_name?: string;
  package_name?: string;
  count?: number;
  keys?: string[];
  /** Where the relocated endpoint nests them, per the provider's own client. */
  data?: { keys?: string[]; key?: string };
  /** Older shape: a single key rather than an array. */
  key?: string;
}

/**
 * Single entry point to the upstream license API. The credentials live
 * in env vars and are attached here, so they never reach the browser.
 *
 * The body is JSON, shaped the way the provider's reference client sends
 * it -- not the form encoding the retired host took. Numbers stay
 * numbers: `generate_key` wants `days` and `count` as integers, and a
 * JSON string is a different value where a form field was not.
 *
 * `app_id` goes only on `generate_key`, the one action that names an
 * app. The key actions are `{api_key, action, key}` and nothing else in
 * the reference client, and the listings (`get_admin_packages`,
 * `reseller_stats`) answer identically without it -- each package row
 * carries its own `app_id`. Attaching it everywhere was a leftover of
 * the old host, and an unasked-for field is one more thing the provider
 * can one day start rejecting.
 *
 * The two listings the dashboard refreshes constantly are answered from
 * memory for a short while; see CACHE_TTL_MS.
 */
export async function callLicenseApi<T extends LicenseEnvelope>(
  action: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const ttl = CACHE_TTL_MS[action];
  if (ttl !== undefined) return cachedRead<T>(action, params, ttl);

  try {
    return await sendToLicenseApi<T>(action, params);
  } finally {
    // Settled either way: a call that failed or timed out may still have
    // landed upstream, so the counts are suspect after any attempt.
    if (!READ_ONLY_ACTIONS.has(action)) forgetCounts();
  }
}

/**
 * How long a read may be answered from this instance's memory.
 *
 * Every dashboard refresh -- after each action, and on every realtime
 * ping, in every open tab -- asks for both of these, and each one was a
 * fresh round trip to the provider. The package list changes when the
 * provider adds or renames a package, which is rare, so five minutes
 * costs nothing. The counts move with every key issued anywhere, so they
 * are held only long enough to absorb a burst of refreshes -- and a
 * change made through this instance drops them at once (forgetCounts).
 *
 * Nothing else is cached. Every other action either changes something
 * or, like key_info, is a lookup someone asked for by hand, where an
 * answer from a minute ago is the wrong answer.
 *
 * The provider answers both per API key, not per panel user -- neither
 * call carries anyone's identity -- so one entry per action and
 * parameter set is the whole of what the answer depends on. Each
 * serverless instance keeps its own copy, which only means a cold one
 * asks again.
 */
const CACHE_TTL_MS: Partial<Record<string, number>> = {
  get_admin_packages: 5 * 60_000,
  reseller_stats: 10_000,
};

/** Actions that change nothing upstream, so leave the cached counts standing. */
const READ_ONLY_ACTIONS = new Set(["get_admin_packages", "reseller_stats", "key_info"]);

/** Cleared whenever this instance changes something upstream. */
const COUNT_ACTIONS = new Set(["reseller_stats"]);

interface Cached {
  action: string;
  value: LicenseEnvelope;
  expires: number;
}

const answers = new Map<string, Cached>();
const inFlight = new Map<string, { action: string; request: Promise<LicenseEnvelope> }>();

/**
 * Bumped by every change. A read that was already on its way when the
 * change landed may carry the old counts, so it is handed to whoever
 * asked for it but not kept.
 */
let generation = 0;

async function cachedRead<T extends LicenseEnvelope>(
  action: string,
  params: Record<string, string | number>,
  ttl: number,
): Promise<T> {
  const key = `${action}\u0000${JSON.stringify(Object.entries(params).sort())}`;

  const hit = answers.get(key);
  if (hit && hit.expires > Date.now()) return structuredClone(hit.value) as T;

  // Callers arriving while a request is out share it rather than each
  // sending their own: a refresh asks for both lists at once, and several
  // tabs refreshing on the same ping would otherwise multiply that.
  let pending = inFlight.get(key);
  if (!pending) {
    const started = generation;
    const request = sendToLicenseApi<LicenseEnvelope>(action, params)
      .then((value) => {
        // Only a success is kept. A failure envelope describes a moment,
        // and repeating it for five minutes would turn a blip into an
        // outage; a thrown error never reaches here at all.
        if (value.success === true && started === generation) {
          answers.set(key, { action, value, expires: Date.now() + ttl });
        }
        return value;
      })
      .finally(() => {
        if (inFlight.get(key)?.request === request) inFlight.delete(key);
      });
    pending = { action, request };
    inFlight.set(key, pending);
  }

  // A copy each, so no caller can edit the answer another one is handed.
  return structuredClone(await pending.request) as T;
}

/** Drops the cached counts, and any read of them already on its way. */
function forgetCounts(): void {
  generation += 1;
  for (const [key, entry] of answers) {
    if (COUNT_ACTIONS.has(entry.action)) answers.delete(key);
  }
  for (const [key, entry] of inFlight) {
    if (COUNT_ACTIONS.has(entry.action)) inFlight.delete(key);
  }
}

/** The request itself, uncached. Everything goes through callLicenseApi. */
async function sendToLicenseApi<T extends LicenseEnvelope>(
  action: string,
  params: Record<string, string | number>,
): Promise<T> {
  if (!API_KEY || !APP_ID) {
    throw new HttpError(
      500,
      "License API is not configured. Set LICENSE_API_KEY and LICENSE_APP_ID.",
    );
  }

  const payload = {
    api_key: API_KEY,
    action,
    ...(action === "generate_key" ? { app_id: APP_ID } : {}),
    ...params,
  };

  try {
    // The status is not checked: a missing key comes back as a 404 that
    // still carries the usual `{success: false, message}` envelope, and
    // that message is the one worth showing.
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    return (await response.json()) as T;
  } catch (err) {
    throw new HttpError(502, `License API unreachable: ${(err as Error).message}`);
  }
}

export const getPackages = () => callLicenseApi<PackagesResponse>("get_admin_packages");

/**
 * Resolves a package id the bundled list does not know about.
 *
 * The generator renders whatever the API reports, so a package added
 * upstream appears immediately -- but generation used to validate only
 * against the hardcoded list and answer "Unknown package." for it. This
 * asks the API instead, so the two can drift without breaking.
 */
export async function livePackage(
  packageId: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const data = await getPackages();
    const match = data.packages?.find((p) => p.package_id === packageId);
    return match ? { id: match.package_id, name: match.package_name } : null;
  } catch {
    return null;
  }
}

export const getStats = () => callLicenseApi<StatsResponse>("reseller_stats");

export const getKeyInfo = (key: string) => callLicenseApi<KeyInfoResponse>("key_info", { key });

/**
 * The package names a reseller grant is allowed to contain.
 *
 * The live list, because the generator sells from the live list. A
 * package the provider offers but this check refuses is one that can
 * be sold and not granted -- which is precisely how FPS BOOSTER came
 * to be generatable and ungrantable at once, the grant routes having
 * filtered against the compiled-in names while the generator read the
 * API.
 *
 * Falls back to the bundled names when the provider is unreachable, so
 * an outage narrows what can be granted rather than silently emptying
 * every grant that passes through it.
 */
export async function grantablePackageNames(): Promise<string[]> {
  try {
    const data = await getPackages();
    const names = (data.packages ?? [])
      .map((p) => p.package_name)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names;
  } catch {
    /* fall through to the bundled list */
  }
  return PACKAGE_NAMES;
}
