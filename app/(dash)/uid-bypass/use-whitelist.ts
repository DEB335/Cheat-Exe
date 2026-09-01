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

async function fetchEntries(): Promise<WhitelistEntry[]> {
  const data = await api<{ entries?: WhitelistEntry[] }>("/api/uid-bypass");
  return data.entries ?? [];
}

interface WhitelistState {
  entries: WhitelistEntry[];
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
 */
export function useWhitelist(auto: boolean): WhitelistState {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The first read is written inline rather than through `reload` so the
  // `alive` guard can wrap it: the upstream call can outlive the page,
  // and a response landing after a navigation must not write state.
  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const next = await fetchEntries();
        if (alive) {
          setEntries(next);
          setError(null);
        }
      } catch (err) {
        if (alive) setError((err as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      setEntries(await fetchEntries());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void reload(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [auto, reload]);

  return { entries, loading, error, reload };
}
