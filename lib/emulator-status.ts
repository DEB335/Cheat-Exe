import type { EmulatorEngine, EmulatorMaintenance } from "./types";

/**
 * One place that decides which Lib Bypass engines are down.
 *
 * The provider reports maintenance only when a key is minted -- the
 * `generate_lib_key` reply carries `maintenance: true`, the engine in
 * `target` and, when one is still up, the other in `recommended_version`.
 * The route turns that into `emulatorBypassMaintenance`; everything that
 * renders a banner reads it back through here, so the overview, the
 * emulator page and the generator all agree on exactly the same verdict
 * instead of each re-deriving it (and drifting apart).
 */

/**
 * How long a learned "engine is down" survives without being refreshed.
 *
 * There is no way to ask the provider whether an engine is back: the only
 * action that reports maintenance is `generate_lib_key`, and every probe
 * candidate either fails validation before the maintenance check or mints
 * a real key (verified against the live API). A learned flag is therefore
 * a memory of the last failed attempt, not a fact, and it has to decay --
 * after this window the engine is offered again, the next attempt
 * re-learns the truth, and a recovered engine re-opens on its own. No
 * button to press, nothing that can lie about a state it cannot observe.
 */
export const MAINTENANCE_TTL_MS = 10 * 60_000;

export interface EmulatorStatus {
  /** Version 1 (Discord Bot Engine) is down. */
  v1: boolean;
  /** Version 2 (Sensix Direct Server Engine) is down. */
  v2: boolean;
  /** At least one engine is down. */
  any: boolean;
  /** Both engines are down. */
  all: boolean;
  /** The engine the provider recommends while one is down, if known. */
  recommended: EmulatorEngine | null;
  /** Why, in the provider's words. */
  reason: string | null;
  /** The stored manual override, before per-engine derivation. */
  active: boolean;
}

/**
 * Reads the stored state into a per-engine verdict.
 *
 * An explicit `v1Maintenance` / `v2Maintenance` always wins. Without one,
 * the legacy `active` + `engine` pair is honoured -- and an `active` with
 * no engine means both, which is how the owner's manual switch has always
 * behaved. Anything that cannot be read as "down" is up: a missing flag
 * must never invent a maintenance that is not happening.
 *
 * This is deliberately unaware of the clock: whose flag is still valid is
 * decided by `pruneExpiredMaintenance`, which runs on the server, so the
 * browser only ever sees state that was already checked against the TTL.
 */
export function deriveEmulatorStatus(
  maint?: EmulatorMaintenance | null,
): EmulatorStatus {
  const active = Boolean(maint?.active);
  const engine = maint?.engine;
  const legacyAll = active && (engine === "ALL" || !engine);

  const v1 =
    maint?.v1Maintenance !== undefined
      ? Boolean(maint.v1Maintenance)
      : Boolean(legacyAll || (active && engine === "V1"));
  const v2 =
    maint?.v2Maintenance !== undefined
      ? Boolean(maint.v2Maintenance)
      : Boolean(legacyAll || (active && engine === "V2"));

  // Only meaningful while exactly one engine is down: the provider names
  // the other one, and that is the engine still up. With both up (or both
  // down) there is nothing to recommend, and a value remembered from an
  // earlier outage must not leak into a badge that then reads wrong.
  const recommended: EmulatorEngine | null =
    v1 && !v2 ? "V2" : v2 && !v1 ? "V1" : null;

  return {
    v1,
    v2,
    any: v1 || v2,
    all: v1 && v2,
    recommended,
    reason: maint?.reason ?? null,
    active,
  };
}

/** Whether a recorded down-since has outlived `MAINTENANCE_TTL_MS`. */
function lapsed(since: string | undefined, now: number): boolean {
  if (!since) return false;
  const at = Date.parse(since);
  return Number.isFinite(at) && now - at >= MAINTENANCE_TTL_MS;
}

/**
 * Drops any per-engine flag whose learned timestamp has lapsed, so the
 * engine reads as up again and can be tried. A flag with no timestamp was
 * set by hand (or predates this field) and is left alone -- the owner
 * turns those off themselves.
 *
 * Returns `maint` itself when nothing changed, so callers can compare by
 * identity and the store's `share()` keeps the same object every poll.
 */
export function pruneExpiredMaintenance(
  maint: EmulatorMaintenance | undefined | null,
  now: number = Date.now(),
): EmulatorMaintenance | undefined {
  if (!maint) return maint ?? undefined;

  const status = deriveEmulatorStatus(maint);
  const v1 = status.v1 && !lapsed(maint.v1Since, now);
  const v2 = status.v2 && !lapsed(maint.v2Since, now);

  if (v1 === status.v1 && v2 === status.v2) return maint;
  if (!v1 && !v2) return { active: false };

  return {
    active: true,
    v1Maintenance: v1,
    v2Maintenance: v2,
    engine: v1 && v2 ? "ALL" : v1 ? "V1" : "V2",
    ...(v1 && maint.v1Since ? { v1Since: maint.v1Since } : {}),
    ...(v2 && maint.v2Since ? { v2Since: maint.v2Since } : {}),
    ...(maint.recommended ? { recommended: maint.recommended } : {}),
    ...(maint.reason ? { reason: maint.reason } : {}),
  };
}

/**
 * The next stored state after learning one engine's fate.
 *
 * `down` true records a maintenance the provider just reported; false
 * records a successful generation, which is the only proof an engine is
 * back. The other engine is carried over from the previous state, read
 * through `pruneExpiredMaintenance` so a stale flag is dropped (and a
 * legacy `active` + `engine` pair is understood) rather than kept alive.
 */
export function withEngineMaintenance(
  prev: EmulatorMaintenance | undefined | null,
  engine: EmulatorEngine,
  down: boolean,
  opts: { reason?: string; recommended?: EmulatorEngine | null } = {},
  now: number = Date.now(),
): EmulatorMaintenance {
  const kept = pruneExpiredMaintenance(prev, now) ?? { active: false };
  const before = deriveEmulatorStatus(kept);

  const v1 = engine === "V1" ? down : before.v1;
  const v2 = engine === "V2" ? down : before.v2;

  // The engine whose fate we just learned gets a fresh clock (or loses it
  // when it came back); the other keeps its own, so one engine's attempt
  // never silently extends the other's lock.
  const v1Since =
    engine === "V1" ? (down ? new Date(now).toISOString() : undefined) : before.v1 ? kept.v1Since : undefined;
  const v2Since =
    engine === "V2" ? (down ? new Date(now).toISOString() : undefined) : before.v2 ? kept.v2Since : undefined;

  const recommended: EmulatorEngine | null =
    v1 && !v2
      ? "V2"
      : v2 && !v1
        ? "V1"
        : (opts.recommended ?? kept.recommended ?? null);

  const reason = opts.reason ?? kept.reason;

  return {
    active: v1 || v2,
    v1Maintenance: v1,
    v2Maintenance: v2,
    ...(v1Since ? { v1Since } : {}),
    ...(v2Since ? { v2Since } : {}),
    engine: v1 && v2 ? "ALL" : v1 ? "V1" : v2 ? "V2" : undefined,
    ...(recommended ? { recommended } : {}),
    ...(reason ? { reason } : {}),
  };
}
