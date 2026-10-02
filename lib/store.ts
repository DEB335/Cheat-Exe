"use client";

import { useMemo } from "react";
import { create } from "zustand";

import { PACKAGES } from "./packages";
import type { LicensePackage, PublicDatabase, SessionUser } from "./types";

const EMPTY: PublicDatabase = {
  cheatExeUsers: {},
  cheatExeKeyHistory: [],
  cheatExeAuditLogs: [],
  cheatExeDevices: [],
  cheatExeBannedUsers: [],
  cheatExeBans: [],
  cheatExeMessages: [],
  adminUser: "",
  profile: {
    displayName: "Cheat Exe",
    avatar: "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif",
    banner: "https://cdn.imageurlgenerator.com/uploads/696b036b-a046-46e7-a9c0-2616ffe2ddaf.gif",
  },
};

/** Live counts from the upstream license API. */
export interface LicenseStats {
  username: string;
  totalKeys: number;
  activeKeys: number;
  bannedKeys: number;
  usedKeys: number;
  keyLimit: number;
  keysCreated: number;
  remaining: number;
}

interface DashboardState {
  user: SessionUser | null;
  db: PublicDatabase;
  stats: LicenseStats | null;
  packages: LicensePackage[];
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  /** Re-reads the server state. Every mutation calls this when it lands. */
  refresh: () => Promise<void>;
  /**
   * Applies a change to the local copy immediately, without a round trip.
   *
   * A write plus a full re-read is roughly half a second against a remote
   * database, and until it returns the UI shows the old state -- which is
   * what makes clicking a reaction feel broken. Callers paint the
   * expected result first, fire the request, and let the next refresh or
   * realtime ping reconcile. If the request fails they hand back the
   * snapshot this returns.
   */
  patch: (apply: (db: PublicDatabase) => PublicDatabase) => PublicDatabase;
  /** Puts back a snapshot taken before an optimistic change. */
  restore: (snapshot: PublicDatabase) => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * `next`, with every part that is unchanged from `prev` swapped back for
 * prev's own object -- and `prev` itself when nothing changed at all.
 *
 * Every refresh parses a brand-new tree, so without this one new reaction
 * handed every list in the store a new identity: each subscriber
 * re-rendered, every memo keyed on a list recomputed, and the overview
 * chart replayed its entrance animation. Arrays are matched by content
 * rather than by position, so a key prepended to the history leaves
 * every row below it the object it was.
 */
function share<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;

  if (Array.isArray(prev) && Array.isArray(next)) {
    const pool = new Map<string, unknown[]>();
    for (const item of prev) {
      const key = JSON.stringify(item) ?? "";
      const same = pool.get(key);
      if (same) same.push(item);
      else pool.set(key, [item]);
    }
    let unchanged = prev.length === next.length;
    const out = next.map((item, i) => {
      const hit = pool.get(JSON.stringify(item) ?? "")?.shift();
      if (hit === undefined) {
        unchanged = false;
        return item;
      }
      if (hit !== prev[i]) unchanged = false;
      return hit;
    });
    return (unchanged ? prev : out) as T;
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let unchanged = keys.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = share(prev[key], next[key]);
      if (out[key] !== prev[key] || !(key in prev)) unchanged = false;
    }
    return (unchanged ? prev : out) as T;
  }

  return next;
}

/** GETs a JSON endpoint; null on any failure, so it can be left unawaited. */
async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The last /api/db body applied and the `db` it produced. A refresh that
 * reads back the same text while the store still holds that same object
 * changes nothing, and is dropped before it costs a parse or a render.
 */
let lastBody = "";
let lastDb: PublicDatabase | null = null;

/**
 * Refreshes overlap -- a mutation's, the session poll's, a realtime
 * ping's -- and the network does not answer them in order. Each is
 * numbered, and an answer older than one already applied is dropped
 * rather than painted over newer data.
 */
let issued = 0;
let applied = 0;
let statsApplied = 0;
let inFlight = 0;

/**
 * The package catalogue is upstream's product list: it changes with a
 * release, not between clicks, so one good read per page load is enough.
 * The route's bundled fallback (upstream unreachable) does not count, so
 * the next refresh tries again.
 */
let packagesLoaded = false;

/** Whether a /api/db read is on its way, i.e. fresher data is coming anyway. */
export function isRefreshing(): boolean {
  return inFlight > 0;
}

export const useDashboard = create<DashboardState>((set, get) => ({
  user: null,
  db: EMPTY,
  stats: null,
  packages: PACKAGES,
  loading: true,
  setUser: (user) => set({ user }),

  patch: (apply) => {
    const before = get().db;
    set({ db: apply(before) });
    return before;
  },
  restore: (snapshot) => set({ db: snapshot }),

  refresh: async () => {
    const ticket = ++issued;
    inFlight += 1;

    // All three leave together. Stats and packages used to wait for
    // /api/db to land first, which put two round trips in a row on every
    // load and every mutation. They are best-effort: if the license API
    // is unreachable the dashboard still renders.
    const statsRequest = getJson("/api/stats");
    const packagesRequest = packagesLoaded ? null : getJson("/api/packages");

    try {
      try {
        const response = await fetch("/api/db", { cache: "no-store" });
        if (!response.ok) {
          // 401 means there is no session at all -- nothing to explain, so a
          // hard navigation is right: it discards every piece of client state
          // along with the dead cookie.
          //
          // 403 is different. The session exists but the account was just
          // suspended, expired, banned or device-locked, and the shell's
          // session check knows *which* -- it shows that reason and then
          // redirects with it. Redirecting from here would race that check and
          // win, dumping the user on a blank login page with no idea why.
          if (response.status === 401) {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login";
          }
          return;
        }
        const body = await response.text();
        if (ticket >= applied) {
          applied = ticket;
          const state = get();
          if (body === lastBody && state.db === lastDb) {
            if (state.loading) set({ loading: false });
          } else {
            const db = share(state.db, JSON.parse(body) as PublicDatabase);
            lastBody = body;
            lastDb = db;
            if (db !== state.db || state.loading) set({ db, loading: false });
          }
        }
      } catch {
        if (get().loading) set({ loading: false });
        return;
      }

      const [stats, packages] = await Promise.all([statsRequest, packagesRequest]);

      if (stats?.success && ticket >= statsApplied) {
        statsApplied = ticket;
        const held = get().stats;
        const next = share(held, stats.stats as LicenseStats);
        if (next !== held) set({ stats: next });
      }
      const list = packages?.packages as LicensePackage[] | undefined;
      if (list?.length) {
        packagesLoaded = packages?.source !== "fallback";
        const held = get().packages;
        const next = share(held, list);
        if (next !== held) set({ packages: next });
      }
    } finally {
      inFlight -= 1;
    }
  },
}));

/**
 * The packages this account may generate for, as they stand right now.
 *
 * Deliberately not `user.packages`. That array is a copy taken at login
 * and signed into the session token, which is never re-issued -- so a
 * permission the owner grants or revokes mid-session stayed invisible
 * here for the rest of the twelve-hour token, and the reseller had to
 * sign out and back in before a newly granted panel appeared.
 *
 * The reseller's own record comes down with /api/db on every refresh and
 * a permission change pings, so reading the grant from there is what
 * makes it land live. The token's copy is the fallback only until that
 * record has loaded, and for the owner, who has no reseller record.
 */
export function useMyPackages(): string[] {
  const user = useDashboard((s) => s.user);
  const users = useDashboard((s) => s.db.cheatExeUsers);

  return useMemo(() => {
    if (!user) return [];
    const record = Object.entries(users).find(
      ([name]) => name.toLowerCase() === user.username.toLowerCase(),
    )?.[1];
    return record?.packages ?? user.packages;
  }, [user, users]);
}

/**
 * Numbers behind the five overview tiles.
 *
 * For the owner these come from the license API, which is the only place
 * that knows the truth -- the original derived them from localStorage,
 * which drifts the moment a key is issued or revoked anywhere else. A
 * reseller is a concept local to this panel, so their figures stay local.
 */
export function useMetrics() {
  // Counts, not the lists: a selector that returns a number only wakes
  // this up when the number moves, where one returning `db` woke every
  // tile and the chart for any change anywhere in the snapshot.
  const deviceCount = useDashboard((s) => s.db.cheatExeDevices.length);
  const keyCount = useDashboard((s) => s.db.cheatExeKeyHistory.length);
  const resellerCount = useDashboard((s) => Object.keys(s.db.cheatExeUsers).length);
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");
  const stats = useDashboard((s) => s.stats);
  const packageCount = useDashboard((s) => s.packages.length);
  const mine = useMyPackages();

  if (isOwner && stats) {
    return {
      apps: packageCount,
      licenses: stats.totalKeys,
      users: stats.usedKeys,
      devices: deviceCount,
      resellers: resellerCount,
      live: true,
    };
  }

  // A reseller has no upstream account of their own: `stats` is the
  // owner's whole license account, and showing it here would leak
  // someone else's totals under this reseller's name. Everything below
  // instead comes from this reseller's own slice of `db`, which
  // /api/db already scopes to them -- `cheatExeKeyHistory` is filtered
  // to keys *they* created, so counting it is correct, not a guess.
  // `resellers` stays 0 for a fact, not a placeholder: this data model
  // has no sub-resellers, so a reseller managing zero of them is true.
  // `users` has no such fact to fall back on -- nothing here tracks who
  // used a reseller's keys, so any number would be invented. It stays 0
  // rather than fabricate one, but the tile that renders it lives in
  // app/(dash)/dashboard/page.tsx, outside this file; ideally that tile
  // is hidden for non-owners instead of showing a zero that reads as a
  // measurement.
  return {
    apps: isOwner ? packageCount : mine.length,
    licenses: keyCount,
    users: 0,
    devices: deviceCount,
    resellers: isOwner ? resellerCount : 0,
    live: false,
  };
}
