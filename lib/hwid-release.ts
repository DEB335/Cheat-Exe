import "server-only";

import { createHmac } from "node:crypto";

import { readSlice } from "./db";
import { callLicenseApi, getKeyInfo, type KeyInfoResponse, type LicenseEnvelope } from "./license-api";

/**
 * What one attempt to free a key's device came to.
 *
 *  - released -- it was bound, and reset_hwid cleared it.
 *  - free     -- nothing was bound, so there was nothing to do.
 *  - missing  -- the provider has no such key (deleted upstream).
 *  - banned   -- left alone: a banned key is refused on every device, and
 *                freeing it would only spend a call to change nothing.
 *  - expired  -- left alone for the same reason.
 *  - locked   -- it was bound, but by the time the reset was due the key
 *                had been locked again (or left the history), so the
 *                device holding it keeps it.
 *  - error    -- the lookup or the reset failed. The next sweep retries.
 */
export type ReleaseResult =
  | "released"
  | "free"
  | "missing"
  | "banned"
  | "expired"
  | "locked"
  | "error";

/** What the provider reports in `hwid` for a key no device has claimed. */
const UNBOUND = /^(not bound|none)$/i;

/**
 * Frees the device an unlocked key is bound to, if it is bound to one.
 *
 * The provider binds every key to the first device that uses it and has
 * no setting to stop that, so "unlocked" is this panel undoing the
 * binding after the fact: reset_hwid clears it, and the next device to
 * log in takes the key. Asking key_info first means a key nobody is
 * using costs one lookup rather than a reset, and a reset is only sent
 * when there is something to clear.
 *
 * Never throws. The sweep calls this for every unlocked key in turn, and
 * one key the provider chokes on must not stop the rest; it comes back
 * as "error" and is tried again on the next pass.
 */
export async function releaseKey(key: string): Promise<ReleaseResult> {
  let info: KeyInfoResponse;
  try {
    info = await getKeyInfo(key);
  } catch {
    return "error";
  }

  if (!info.success) {
    // Only the provider's own "not found" counts as missing. Any other
    // refusal says nothing about the key, so it is an error and retried,
    // rather than a reason to stop looking at it.
    return /not found/i.test(info.message ?? "") ? "missing" : "error";
  }

  // Exact matches only. A status this does not recognise is swept like
  // an active key: the cost of that is a lookup, where the cost of
  // wrongly leaving one alone is a customer locked out.
  const status = (info.status ?? "").trim().toLowerCase();
  if (status === "banned") return "banned";
  if (status === "expired") return "expired";

  const hwid = (info.hwid ?? "").trim();
  if (!hwid || UNBOUND.test(hwid)) return "free";

  // Asked again right before the reset, not trusted from whenever the
  // caller looked. The sweep reads the history once and then works
  // through it for seconds; a key the owner locks in that window would
  // otherwise still be reset, and the device holding it would lose it.
  // The same covers an unlock and a re-lock racing from two tabs. Only a
  // bound key pays for the read, since only a bound key is about to be
  // reset. What is left is the few milliseconds between this read and
  // the reset landing upstream.
  try {
    if (!(await stillUnlocked(key))) return "locked";
  } catch {
    return "error";
  }

  try {
    const reset = await callLicenseApi<LicenseEnvelope>("reset_hwid", { key });
    return reset.success ? "released" : "error";
  } catch {
    return "error";
  }
}

/**
 * Whether every history row for this key is still unlocked. A key with
 * no rows at all is not: clearing history is the panel letting go of
 * those keys, and a reset nobody asked for is the wrong default.
 */
async function stillUnlocked(key: string): Promise<boolean> {
  const { cheatExeKeyHistory } = await readSlice(["cheatExeKeyHistory"]);
  const records = cheatExeKeyHistory.filter((r) => r.key === key);
  return records.length > 0 && records.every((r) => r.hwidLock === false);
}

export interface SweepResult {
  /** Set when this instance turned the sweep away; the counts are then zero. */
  skipped?: true;
  /** Keys actually looked up this pass. */
  checked: number;
  released: number;
  errors: number;
  /** Keys passed over because they are backing off (see BACKOFF_MS). */
  skippedKeys: number;
  /** Keys the time budget ran out before; the next pass starts with them. */
  unfinished: number;
}

const NOTHING_DONE = { checked: 0, released: 0, errors: 0, skippedKeys: 0, unfinished: 0 };

/** Lookups in flight at once. Each is ~400ms, so 60 keys take about 4s. */
const SWEEP_CONCURRENCY = 6;

/**
 * The shortest gap between two sweeps on one instance.
 *
 * Every open tab holding an unlocked key asks for a sweep every 20
 * seconds, and the database cron asks every 30, so without this five
 * tabs would mean five full passes over the same keys. Ten seconds lets
 * the first ask through and turns the rest of the burst away. It is per
 * instance -- Vercel may run several, and each keeps its own clock --
 * which only means an occasional extra pass, never a missed one.
 */
const SWEEP_GAP_MS = 10_000;

/**
 * How long one pass may keep handing out keys.
 *
 * The route is allowed 60 seconds. Keys already handed out are let
 * finish -- a lookup, a re-read and a reset come to about a second -- so
 * stopping new ones at 45 leaves room for them, and the pass returns its
 * counts rather than being cut off by the platform with nothing reported.
 */
const SWEEP_BUDGET_MS = 45_000;

/**
 * How long a key that cannot be helped is left alone, on this instance.
 *
 * A key the provider no longer has, or has banned or expired, comes back
 * the same way on every pass, and with enough of them they would crowd
 * out the keys that need freeing. Thirty minutes keeps them out of the
 * way while still noticing within the half hour if one is unbanned.
 * Only these exact outcomes: an error is retried on the very next pass.
 */
const BACKOFF_MS = 30 * 60_000;
const BACKS_OFF = new Set<ReleaseResult>(["missing", "banned", "expired"]);

/** Key -> when it may be looked at again. Per instance, like the throttle. */
const backoff = new Map<string, number>();

/**
 * Where the next pass starts. When the budget runs out the pass stops
 * part-way, and starting every pass from the top would leave the same
 * tail of the history never swept; this picks up where the last one
 * stopped instead.
 */
let sweepCursor = 0;

let lastSweepStarted = 0;
let sweeping = false;

/**
 * Frees the device on every unlocked key in the history.
 *
 * This is what makes "unlocked" true between visits to the panel: a
 * customer who switches machines is refused until the binding is
 * cleared, so it is cleared on a timer. No audit lines and no pings --
 * it runs every twenty seconds or so, and either would bury everything
 * else in noise. Nothing in the panel's own data changes anyway; only
 * the provider's binding does.
 */
export async function sweepUnlockedKeys(): Promise<SweepResult> {
  const started = Date.now();
  if (sweeping || started - lastSweepStarted < SWEEP_GAP_MS) {
    return { skipped: true, ...NOTHING_DONE };
  }
  sweeping = true;
  lastSweepStarted = started;

  try {
    // Only the key history: the rest of the document plays no part here.
    const { cheatExeKeyHistory } = await readSlice(["cheatExeKeyHistory"]);
    const keys = [
      ...new Set(cheatExeKeyHistory.filter((r) => r.hwidLock === false).map((r) => r.key)),
    ];
    if (keys.length === 0) return { ...NOTHING_DONE };

    for (const [key, until] of backoff) {
      if (until <= started) backoff.delete(key);
    }

    const offset = sweepCursor % keys.length;
    const order = [...keys.slice(offset), ...keys.slice(0, offset)];
    const deadline = started + SWEEP_BUDGET_MS;
    const counts = { ...NOTHING_DONE };
    let next = 0;

    async function worker(): Promise<void> {
      while (next < order.length && Date.now() < deadline) {
        const key = order[next++]!;
        if ((backoff.get(key) ?? 0) > Date.now()) {
          counts.skippedKeys += 1;
          continue;
        }

        counts.checked += 1;
        const result = await releaseKey(key);
        if (result === "released") counts.released += 1;
        if (result === "error") counts.errors += 1;
        if (BACKS_OFF.has(result)) backoff.set(key, Date.now() + BACKOFF_MS);
      }
    }
    await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, order.length) }, worker));

    counts.unfinished = order.length - next;
    sweepCursor = offset + next;
    return counts;
  } finally {
    sweeping = false;
  }
}

/**
 * The shared secret the database cron sends in `x-hwid-sweep-token`.
 *
 * The cron has no session cookie, so it proves itself with this instead:
 * an HMAC of a fixed label under SESSION_SECRET. Derived rather than a
 * new env var, so there is nothing extra to set on Vercel, and one-way,
 * so the copy that sits in the cron job's SQL reveals nothing about the
 * secret that signs sessions. All it permits is asking for a sweep.
 * Rotating SESSION_SECRET changes it, and the cron job needs the new one.
 *
 * Null without a usable secret. An HMAC under an empty key is one anyone
 * can compute, so that case accepts no token at all rather than a
 * guessable one.
 */
export function hwidSweepToken(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update("hwid-sweep").digest("hex");
}
