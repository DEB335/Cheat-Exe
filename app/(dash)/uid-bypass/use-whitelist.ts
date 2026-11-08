"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/client-api";
import type { WhitelistEntry } from "@/lib/types";

/** How often the Auto toggle re-reads the list. */
export const AUTO_REFRESH_MS = 10_000;

/**
 * How often the service health is checked, independent of the Auto
 * toggle. Short enough to feel live (~a couple of seconds at worst),
 * and cheap: the route answers it from a small server-side cache, and
 * it only ever moves the maintenance flag -- it never returns the list.
 */
export const STATUS_POLL_MS = 2_000;

/**
 * Whether a whitelist entry is still good, and for how much longer.
 *
 * Upstream dates are plain "YYYY-MM-DD" with no timezone, and it treats
 * the expiry day itself as valid -- a UID expiring today still works
 * today. Comparing whole days rather than instants is what keeps this
 * agreeing with the provider instead of expiring an entry at midnight
 * UTC in the middle of a customer's last day.
 */
export function daysLeft(expireDate: string): number | null {
  // Coerced rather than trusted: this runs during render, so a value
  // that is not a string takes the whole page down with it.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(expireDate ?? "").trim());
  if (!match) return null;

  const expiry = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((expiry - today) / 86_400_000);
}

export function isExpired(entry: WhitelistEntry): boolean {
  const left = daysLeft(entry.expireDate);
  return left !== null && left < 0;
}

type WhitelistPayload = {
  entries?: WhitelistEntry[];
  maintenance?: boolean;
  reason?: string;
};

interface Snapshot {
  entries: WhitelistEntry[];
  /** The provider is unreachable, or has been paused deliberately. */
  maintenance: boolean;
  /** Why, in the provider's words. For whoever can act on it. */
  reason: string | null;
}

async function fetchState(): Promise<Snapshot> {
  const data = await api<WhitelistPayload>("/api/uid-bypass");
  return {
    entries: data.entries ?? [],
    maintenance: data.maintenance === true,
    reason: data.reason ?? null,
  };
}

/** The health probe: the maintenance flag only, never the list. */
async function fetchStatus(): Promise<Pick<Snapshot, "maintenance" | "reason">> {
  const data = await api<WhitelistPayload>("/api/uid-bypass?status=1");
  return {
    maintenance: data.maintenance === true,
    reason: data.reason ?? null,
  };
}

interface WhitelistState extends Snapshot {
  /** First load only, so a background refresh never blanks the list. */
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /**
   * Paints a change locally, before the server has agreed to it.
   *
   * The provider answers in about 400ms and the write is followed by a
   * re-read, so a delete that waits for both leaves the row on screen
   * for over a second -- long enough to look broken and be clicked
   * again. Callers paint the expected result, then reconcile.
   */
  mutate: (updater: (prev: WhitelistEntry[]) => WhitelistEntry[]) => void;
}

/**
 * Reads the whitelist from `/api/uid-bypass`.
 *
 * Kept out of the zustand store on purpose: this list lives entirely
 * upstream, not in `app_state`, so it has nothing to do with the
 * snapshot `/api/db` hands out and a `refresh()` there must not be made
 * to wait on a third-party API.
 *
 * The route reports an unreachable provider as `maintenance` rather than
 * as an error, so what still throws here is this app's own failure --
 * equally a reason not to offer a form that spends credits. Both land on
 * the same flag, and `reason` is what tells them apart afterwards.
 */
export function useWhitelist(auto: boolean, enabled: boolean = true): WhitelistState {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const apply = useCallback((next: Snapshot) => {
    setEntries(next.entries);
    setMaintenance(next.maintenance);
    setReason(next.reason);
    setError(null);
  }, []);

  const fail = useCallback((err: unknown) => {
    const message = (err as Error).message;
    setError(message);
    setMaintenance(true);
    setReason(message);
  }, []);

  // The first read is written inline rather than through `reload` so the
  // `alive` guard can wrap it: the upstream call can outlive the page,
  // and a response landing after a navigation must not write state.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let alive = true;

    void (async () => {
      try {
        const next = await fetchState();
        if (alive) apply(next);
      } catch (err) {
        if (alive) fail(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [enabled, apply, fail]);

  const mutate = useCallback(
    (updater: (prev: WhitelistEntry[]) => WhitelistEntry[]) => setEntries(updater),
    [],
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      apply(await fetchState());
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, apply, fail]);

  // Only while someone can see the list. A hidden tab stops asking the
  // provider, and on coming back catches up at once if a tick was missed,
  // then carries on at the usual pace.
  useEffect(() => {
    if (!auto || !enabled) return;

    let timer = 0;
    let last = Date.now();
    const tick = () => {
      last = Date.now();
      void reload();
    };
    const start = () => {
      if (!timer) timer = window.setInterval(tick, AUTO_REFRESH_MS);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      if (Date.now() - last >= AUTO_REFRESH_MS) tick();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [auto, enabled, reload]);

  // Service health, checked on its own timer -- on even when the Auto
  // toggle is off, because maintenance is a state of the service, not of
  // this list. Separate from `reload` on purpose: a change moves only the
  // flag, so the list stays on screen instead of blinking empty while a
  // fresh read is in flight. Visibility-gated and overlap-guarded so a
  // slow provider cannot pile up requests. A failed probe changes
  // nothing -- the full read is what decides maintenance; a probe that
  // simply could not be reached is not itself a maintenance.
  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    let inFlight = false;
    let timer = 0;

    const tick = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const health = await fetchStatus();
        if (alive) {
          setMaintenance(health.maintenance);
          setReason(health.reason);
        }
      } catch {
        // Leave the current flag alone; see above.
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      if (!timer) timer = window.setInterval(() => void tick(), STATUS_POLL_MS);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void tick();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { entries, loading, error, maintenance, reason, reload, mutate };
}
