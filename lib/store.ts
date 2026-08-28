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
      const db = (await response.json()) as PublicDatabase;
      set({ db, loading: false });
    } catch {
      set({ loading: false });
      return;
    }

    // Upstream counts and the package list are best-effort: if the
    // license API is unreachable the dashboard still renders.
    const [stats, packages] = await Promise.allSettled([
      fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/packages", { cache: "no-store" }).then((r) => r.json()),
    ]);

    if (stats.status === "fulfilled" && stats.value?.success) {
      set({ stats: stats.value.stats as LicenseStats });
    }
    if (packages.status === "fulfilled" && packages.value?.packages?.length) {
      set({ packages: packages.value.packages as LicensePackage[] });
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
  const db = useDashboard((s) => s.db);
  const user = useDashboard((s) => s.user);
  const stats = useDashboard((s) => s.stats);
  const packages = useDashboard((s) => s.packages);
  const mine = useMyPackages();
  const isOwner = user?.role === "OWNER";

  if (isOwner && stats) {
    return {
      apps: packages.length,
      licenses: stats.totalKeys,
      users: stats.usedKeys,
      devices: db.cheatExeDevices.length,
      resellers: Object.keys(db.cheatExeUsers).length,
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
    apps: isOwner ? packages.length : mine.length,
    licenses: db.cheatExeKeyHistory.length,
    users: 0,
    devices: db.cheatExeDevices.length,
    resellers: isOwner ? Object.keys(db.cheatExeUsers).length : 0,
    live: false,
  };
}
