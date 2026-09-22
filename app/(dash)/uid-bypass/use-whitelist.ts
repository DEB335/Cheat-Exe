"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/client-api";
import type { WhitelistEntry } from "@/lib/types";

/** How often the Auto toggle re-reads the list. */
export const AUTO_REFRESH_MS = 10_000;

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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expireDate.trim());
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

interface WhitelistState extends Snapshot {
  /** First load only, so a background refresh never blanks the list. */
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
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
export function useWhitelist(auto: boolean): WhitelistState {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [apply, fail]);

  const reload = useCallback(async () => {
    try {
      apply(await fetchState());
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [apply, fail]);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void reload(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [auto, reload]);

  return { entries, loading, error, maintenance, reason, reload };
}
