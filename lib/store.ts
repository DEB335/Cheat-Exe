"use client";

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
}

export const useDashboard = create<DashboardState>((set) => ({
  user: null,
  db: EMPTY,
  stats: null,
  packages: PACKAGES,
  loading: true,
  setUser: (user) => set({ user }),
  refresh: async () => {
    try {
      const response = await fetch("/api/db", { cache: "no-store" });
      if (!response.ok) {
        // A hard navigation on session loss is deliberate: it discards every
        // piece of client state along with the dead session. 403 means the
        // account was suspended or the device blocked mid-session, which is
        // just as final as an expired cookie.
        if (response.status === 401 || response.status === 403) {
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

  return {
    apps: isOwner ? packages.length : (user?.packages.length ?? 0),
    licenses: db.cheatExeKeyHistory.length,
    users: 0,
    devices: db.cheatExeDevices.length,
    resellers: isOwner ? Object.keys(db.cheatExeUsers).length : 0,
    live: false,
  };
}
