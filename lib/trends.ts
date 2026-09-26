"use client";

import { useMemo, useSyncExternalStore } from "react";

import { useDashboard, useMetrics } from "./store";

export type TileKey = "apps" | "licenses" | "users" | "devices" | "resellers";

export interface Trend {
  /** Percentage change over the window, or null when no history exists to measure it. */
  change: number | null;
  /** Oldest-first points for the sparkline, or null when there is no history. */
  series: number[] | null;
  /** Caption under the change, e.g. "vs. last 7 days". */
  caption: string;
  /**
   * What was counted, when it is not the tile's own number. The Devices
   * tile shows a live count with no past, so its trend is sign-ins -- and
   * says so, rather than letting "+9%" read as nine percent more devices.
   */
  metric?: string;
  /**
   * A plain count, shown instead of a percentage when the base is zero.
   * Five keys added to an empty account is not "+∞%", and it is not
   * nothing either.
   */
  added?: number;
}

const DAY = 86_400_000;
const WEEK = 7;

/**
 * Reads the stamps this app writes: "24/08/2026, 22:37:27" from
 * formatTimestamp and "24/08/2026" from formatDateOnly, both day-first.
 * An ISO string is accepted too, in case a record ever arrives in one.
 * Anything else is NaN and gets skipped -- a trend built from a guessed
 * date is worse than a trend one record short.
 */
export function parseStamp(stamp: string | undefined | null): number {
  if (!stamp) return NaN;
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(stamp);
  if (match) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    // new Date rolls 31/02 over into March; a stamp that does not
    // survive the round trip was never a real date.
    if (date.getDate() !== Number(d) || date.getMonth() !== Number(m) - 1) return NaN;
    return date.getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(stamp)) return Date.parse(stamp);
  return NaN;
}

/** Midnight at the start of the local day, as epoch ms. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Wakes subscribers when the local day rolls over. Module scope, so the
 * subscription is not torn down and re-made on every render.
 */
function subscribeToDay(notify: () => void): () => void {
  let timer = 0;
  const arm = () => {
    window.clearTimeout(timer);
    const now = Date.now();
    timer = window.setTimeout(() => {
      notify();
      arm();
    }, startOfDay(now) + DAY - now + 1000);
  };
  // A sleeping laptop does not fire timers on time; re-check on wake.
  const onVisible = () => {
    if (!document.hidden) {
      notify();
      arm();
    }
  };
  arm();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const todayOnClient = () => startOfDay(Date.now());
const todayOnServer = () => null;

/**
 * Start of today, or null until the client has mounted.
 *
 * The server renders with an empty store and its own clock; reading
 * Date.now() during render would let the two disagree across midnight
 * and break hydration. useSyncExternalStore hands the server snapshot
 * (null) to the hydrating render and the real day straight after. Day
 * granularity keeps the snapshot stable between renders, and one timer
 * rolls it over at midnight so a tab left open overnight moves on.
 */
function useToday(): number | null {
  return useSyncExternalStore(subscribeToDay, todayOnClient, todayOnServer);
}

/**
 * Growth of a running total over the last week, from the dates its
 * members were added.
 *
 * `total` is the tile's own figure, so the sparkline ends exactly on the
 * number printed above it. Each earlier point is that total minus
 * whatever was added after the day ended -- eight points, the first
 * being the base the percentage is measured against.
 */
function runningTotal(stamps: number[], total: number, today: number, caption: string): Trend {
  const windowStart = today - (WEEK - 1) * DAY;
  const added = stamps.filter((t) => t >= windowStart).length;

  const series: number[] = [];
  for (let i = WEEK; i >= 0; i--) {
    const dayEnd = today - (i - 1) * DAY;
    const later = stamps.filter((t) => t >= dayEnd).length;
    series.push(Math.max(0, total - later));
  }

  // History can hold more records than the total (the owner's total
  // comes from the provider, which may have lost keys this panel still
  // lists). Then there is no honest base to divide by.
  const base = total - added;
  if (base <= 0) {
    return added > 0
      ? { change: null, added, series, caption: "added in the last 7 days" }
      : { change: null, series, caption };
  }
  return { change: (added / base) * 100, series, caption };
}

/** Events per local day for the last `WEEK` days, oldest first. */
function perDay(stamps: number[], from: number): number[] {
  const out = new Array<number>(WEEK).fill(0);
  for (const t of stamps) {
    const index = Math.floor((t - from) / DAY);
    if (index >= 0 && index < WEEK) out[index]++;
  }
  return out;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Seven-day trends for the overview tiles, from what the store actually
 * holds. A tile with no history anywhere in this app gets a null change
 * and series, and the tile says so instead of inventing a percentage.
 */
export function useTileTrends(): Record<TileKey, Trend> {
  const today = useToday();
  const loading = useDashboard((s) => s.loading);
  const keyHistory = useDashboard((s) => s.db.cheatExeKeyHistory);
  const resellers = useDashboard((s) => s.db.cheatExeUsers);
  const audit = useDashboard((s) => s.db.cheatExeAuditLogs);
  // The tiles' own figures, so each sparkline ends on the number printed
  // above it.
  const { licenses, resellers: resellerCount } = useMetrics();

  const licenseStamps = useMemo(
    () => keyHistory.map((k) => parseStamp(k.date)).filter(Number.isFinite),
    [keyHistory],
  );
  const resellerStamps = useMemo(
    () => Object.values(resellers).map((r) => parseStamp(r.created)).filter(Number.isFinite),
    [resellers],
  );
  const signInStamps = useMemo(
    () =>
      audit
        .filter((entry) => /logged in successfully/i.test(entry.action))
        .map((entry) => parseStamp(entry.timestamp))
        .filter(Number.isFinite),
    [audit],
  );

  return useMemo(() => {
    // Nothing is known yet: before hydration there is no "today", and
    // before the first load every count is the empty store's zero.
    const pending: Trend = { change: null, series: null, caption: "vs. last 7 days" };
    const none: Trend = { change: null, series: null, caption: "No history yet" };
    if (today === null || loading) {
      return {
        apps: none,
        users: none,
        licenses: pending,
        resellers: pending,
        devices: { ...pending, metric: "sign-ins", caption: "vs. prior week" },
      };
    }

    const thisWeek = today - (WEEK - 1) * DAY;
    const current = perDay(signInStamps, thisWeek);
    const previous = sum(perDay(signInStamps, thisWeek - WEEK * DAY));
    const now = sum(current);
    const devices: Trend =
      previous > 0
        ? { change: ((now - previous) / previous) * 100, series: current, metric: "sign-ins", caption: "vs. prior week" }
        : now > 0
          ? { change: null, added: now, series: current, metric: "sign-ins", caption: "none the week before" }
          : { change: null, added: 0, series: current, metric: "sign-ins", caption: "in the last 14 days" };

    return {
      // No package or key-usage history is recorded anywhere, so these
      // two have nothing to compare against.
      apps: none,
      users: none,
      licenses: runningTotal(licenseStamps, licenses, today, "vs. last 7 days"),
      resellers: runningTotal(resellerStamps, resellerCount, today, "vs. last 7 days"),
      devices,
    };
  }, [today, loading, licenseStamps, resellerStamps, signInStamps, licenses, resellerCount]);
}
