"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";
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

/**
 * `fresh` asks the server to skip its few-second cache of the list (see
 * listWhitelistCached). A read that follows a change -- or a press of
 * Refresh -- has to show that change, and another server instance may
 * still be holding a list from before it.
 */
async function fetchState(fresh: boolean): Promise<Snapshot> {
  const data = await api<WhitelistPayload>(fresh ? "/api/uid-bypass?fresh=1" : "/api/uid-bypass");
  return {
    entries: data.entries ?? [],
    maintenance: data.maintenance === true,
    reason: data.reason ?? null,
  };
}

/**
 * The last list each account saw, held in memory for this page load.
 *
 * The overview and the whitelist page each read the list on arrival,
 * and every visit used to start from a spinner while the provider
 * answered. With this, moving between them -- or leaving and coming
 * back -- paints the last list at once and refreshes it behind the
 * scenes. Memory only, never localStorage: these are customers' UIDs
 * and names, and they should not outlive the tab. Keyed by account so
 * a different sign-in in the same tab never sees someone else's list.
 */
const snapshots = new Map<string, Snapshot>();
const pending = new Map<string, Promise<Snapshot>>();
/** When each account's list last came back, so a hover does not re-ask for a fresh one. */
const fetchedAt = new Map<string, number>();

/** A prefetch inside this window of the last read is skipped. */
const PREFETCH_FRESH_MS = 5_000;

function accountKey(): string | null {
  return useDashboard.getState().user?.username.toLowerCase() ?? null;
}

/** Numbers each read, so an older answer landing late never replaces a newer one. */
let issued = 0;
const newestStored = new Map<string, number>();

/** When this account last changed the list from this tab. */
const localWriteAt = new Map<string, number>();

/**
 * How long after a change every read skips the server's cache: a little
 * over its five seconds. Inside that window another server instance may
 * still hold a list from before the change, and a plain read served
 * from it would put a deleted row back or drop an added one -- and flip
 * which call ADD makes.
 */
const AFTER_WRITE_FRESH_MS = 6_000;

/**
 * Marks the list as just changed from here. Reads for the next few
 * seconds go fresh, and any read already on its way -- it left before
 * the change -- is neither shared any more nor remembered over it.
 */
function noteLocalWrite(key: string | null): void {
  if (key === null) return;
  localWriteAt.set(key, Date.now());
  newestStored.set(key, ++issued);
  pending.delete(key);
}

/**
 * Reads the list once for everyone asking at the same moment -- a
 * prefetch from the sidebar and the page mounting a beat later share
 * one request -- and remembers what it got.
 *
 * A `fresh` read never joins one already on its way: that one may have
 * left before the change it is meant to show. Every read is fresh for a
 * few seconds after a change made here (see AFTER_WRITE_FRESH_MS).
 */
function fetchShared(key: string | null, wantsFresh: boolean): Promise<Snapshot> {
  if (key === null) return fetchState(wantsFresh);

  const fresh =
    wantsFresh || Date.now() - (localWriteAt.get(key) ?? 0) < AFTER_WRITE_FRESH_MS;

  const sharing = pending.get(key);
  if (sharing && !fresh) return sharing;

  const ticket = ++issued;
  const request: Promise<Snapshot> = fetchState(fresh)
    .then((next) => {
      if (ticket > (newestStored.get(key) ?? 0)) {
        newestStored.set(key, ticket);
        snapshots.set(key, next);
        fetchedAt.set(key, Date.now());
      }
      return next;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

/**
 * Starts reading the list before the page that shows it is open.
 *
 * The sidebar calls this when a UID Bypass link is hovered, focused or
 * touched -- those links only render for accounts allowed to see the
 * whitelist -- so by the time the click lands the list is usually
 * already here. A fresh copy already in memory is left alone.
 */
export function prefetchWhitelist(): void {
  const key = accountKey();
  if (key === null || pending.has(key)) return;
  if (Date.now() - (fetchedAt.get(key) ?? 0) < PREFETCH_FRESH_MS) return;
  void fetchShared(key, false).catch(() => {
    /* the page reads it again on arrival and reports any failure there */
  });
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
  // Seeded from the last list this account saw, when there is one: the
  // page paints it at once and the read below refreshes it in place.
  // `loading` -- the spinner -- is only for a first visit with nothing
  // to show yet. A page that does not read the list (`enabled` false,
  // an account without whitelist access) starts and stays empty.
  const [seed] = useState(() => {
    const key = enabled ? accountKey() : null;
    return key === null ? undefined : snapshots.get(key);
  });
  const [entries, setEntries] = useState<WhitelistEntry[]>(seed?.entries ?? []);
  const [loading, setLoading] = useState(seed === undefined);
  const [error, setError] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState(seed?.maintenance ?? false);
  const [reason, setReason] = useState<string | null>(seed?.reason ?? null);

  // Keeps the memory copy in step with what is on screen, local changes
  // included, so a delete painted here is still gone when the page is
  // opened again. A failed read is not a list, so it is not remembered;
  // the last good one stays. The account is read here rather than at
  // render: on a hard load the shell names the user only after this
  // page's first effects have run.
  useEffect(() => {
    const key = accountKey();
    if (!enabled || key === null || loading || error !== null) return;
    snapshots.set(key, { entries, maintenance, reason });
  }, [enabled, loading, error, entries, maintenance, reason]);

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

  // The upstream call can outlive the page, and a response landing after
  // a navigation must not write state.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Reads overlap -- the arrival read, an Auto tick, a reload behind a
  // change -- and the network does not answer them in order. Only the
  // newest one started is allowed to paint, and a local change (mutate)
  // counts as newer than every read already on its way.
  //
  // `loading` is cleared by whichever read settles, newest or not: it
  // only means "nothing to show yet", and holding it for a read that a
  // local change has since outranked would leave the spinner up for good.
  const latest = useRef(0);
  const load = useCallback(
    async (fresh: boolean) => {
      const ticket = ++latest.current;
      try {
        const next = await fetchShared(accountKey(), fresh);
        if (mounted.current && ticket === latest.current) apply(next);
      } catch (err) {
        if (mounted.current && ticket === latest.current) fail(err);
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [apply, fail],
  );

  // On arrival. Shared with a read the sidebar may already have started,
  // and allowed the server's few-second cache: a list painted from
  // memory a moment ago is being refreshed, not proven. Written out
  // rather than through `load` so the effect owns its own `alive` guard.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const ticket = ++latest.current;

    void (async () => {
      try {
        const next = await fetchShared(accountKey(), false);
        if (alive && ticket === latest.current) apply(next);
      } catch (err) {
        if (alive && ticket === latest.current) fail(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [enabled, apply, fail]);

  // A read sent before this change would otherwise land after it and
  // paint the list as it was -- putting a deleted row back, or dropping
  // an added one and flipping which call ADD makes. So a local change
  // outranks every read on its way, here and in the shared memory copy.
  const mutate = useCallback((updater: (prev: WhitelistEntry[]) => WhitelistEntry[]) => {
    noteLocalWrite(accountKey());
    latest.current += 1;
    setEntries(updater);
  }, []);

  // What callers run after a change, and the Refresh button: always a
  // fresh read, so it shows the change it follows. Counted as a change
  // too -- an extend has no mutate of its own -- so reads for the next
  // few seconds, on this page or the next one opened, stay fresh.
  const reload = useCallback(async () => {
    if (!enabled) return;
    noteLocalWrite(accountKey());
    return load(true);
  }, [enabled, load]);

  // Only while someone can see the list. A hidden tab stops asking the
  // provider, and on coming back catches up at once if a tick was missed,
  // then carries on at the usual pace.
  useEffect(() => {
    if (!auto || !enabled) return;

    let timer = 0;
    let last = Date.now();
    const tick = () => {
      last = Date.now();
      // A routine re-read, so a list another tab fetched a moment ago
      // will do.
      void load(false);
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
  }, [auto, enabled, load]);

  // A disabled hook never reads, so it never has anything to wait for.
  return { entries, loading: enabled && loading, error, maintenance, reason, reload, mutate };
}
