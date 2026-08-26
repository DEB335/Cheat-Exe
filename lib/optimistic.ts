"use client";

import type { PublicAnnouncement, PublicDatabase, ResellerStatus } from "./types";

/**
 * Local edits that mirror what the server is about to do.
 *
 * These exist so a click paints immediately instead of after a write and
 * a re-read -- roughly half a second against a remote database, during
 * which the old state stayed on screen and the button felt broken.
 *
 * Each one must produce exactly what the matching API route produces, or
 * the UI will flicker when the real data arrives and overwrites it. They
 * are deliberately kept next to nothing else, so that correspondence is
 * easy to check.
 */

/** Mirrors PATCH /api/messages/:id -- one reaction per person, re-picking clears it. */
export function applyReaction(
  db: PublicDatabase,
  id: string,
  reaction: string,
): PublicDatabase {
  return {
    ...db,
    cheatExeMessages: db.cheatExeMessages.map((m) => {
      if (m.id !== id) return m;

      const had = m.myReaction;
      const next = had === reaction ? null : reaction;
      const counts = { ...m.reactionCounts };

      if (had) counts[had] = Math.max(0, (counts[had] ?? 1) - 1);
      if (had && counts[had] === 0) delete counts[had];
      if (next) counts[next] = (counts[next] ?? 0) + 1;

      const updated: PublicAnnouncement = {
        ...m,
        myReaction: next,
        reactionCounts: counts,
        // Reacting counts as reading, exactly as the route decides.
        read: true,
      };

      // The owner also sees who reacted; keep that in step or their own
      // click would appear to do nothing until the refetch lands.
      if (m.reactions) {
        const map = { ...m.reactions };
        updated.reactions = map;
      }
      return updated;
    }),
  };
}

/** Mirrors PATCH /api/messages -- mark everything read for this viewer. */
export function applyReadAll(db: PublicDatabase): PublicDatabase {
  return {
    ...db,
    cheatExeMessages: db.cheatExeMessages.map((m) => (m.read ? m : { ...m, read: true })),
  };
}

/** Mirrors DELETE /api/messages?scope=mine -- empties this viewer's list only. */
export function applyClearMine(db: PublicDatabase): PublicDatabase {
  return { ...db, cheatExeMessages: [] };
}

/** Mirrors DELETE /api/messages/:id for the owner -- gone for everyone. */
export function applyDeleteMessage(db: PublicDatabase, id: string): PublicDatabase {
  return { ...db, cheatExeMessages: db.cheatExeMessages.filter((m) => m.id !== id) };
}

/* ------------------------------------------------------------------
   Monitoring and reseller tables.

   Same principle as the message helpers above: paint the expected
   result, let the write and the refetch happen behind it. Each mirrors
   exactly what its API route does, so the real data arriving does not
   visibly change anything.
   ------------------------------------------------------------------ */

/** Mirrors DELETE /api/devices/:sessionId -- ends that session. */
export function applyKickDevice(db: PublicDatabase, sessionId: string): PublicDatabase {
  return {
    ...db,
    cheatExeDevices: db.cheatExeDevices.filter((d) => d.sessionId !== sessionId),
  };
}

/** Mirrors DELETE /api/bans -- lifts one block. */
export function applyLiftBan(db: PublicDatabase, scope: string, value: string): PublicDatabase {
  return {
    ...db,
    cheatExeBans: db.cheatExeBans.filter(
      (b) => !(b.scope === scope && b.value.toLowerCase() === value.toLowerCase()),
    ),
  };
}

/** Mirrors PATCH /api/resellers/:name with a status. */
export function applyResellerStatus(
  db: PublicDatabase,
  name: string,
  status: ResellerStatus,
): PublicDatabase {
  const current = db.cheatExeUsers[name];
  if (!current) return db;
  return {
    ...db,
    cheatExeUsers: { ...db.cheatExeUsers, [name]: { ...current, status } },
    // Suspending drops that account's sessions, exactly as the route does.
    cheatExeDevices:
      status === "ACTIVE"
        ? db.cheatExeDevices
        : db.cheatExeDevices.filter(
            (d) => (d.user.split(" ")[0] ?? "").toLowerCase() !== name.toLowerCase(),
          ),
  };
}

/** Mirrors DELETE /api/resellers/:name. */
export function applyRemoveReseller(db: PublicDatabase, name: string): PublicDatabase {
  const users = { ...db.cheatExeUsers };
  delete users[name];
  return {
    ...db,
    cheatExeUsers: users,
    cheatExeDevices: db.cheatExeDevices.filter(
      (d) => (d.user.split(" ")[0] ?? "").toLowerCase() !== name.toLowerCase(),
    ),
  };
}

/** Mirrors DELETE /api/banned/:username -- with or without restore. */
export function applyRemoveVaultEntry(db: PublicDatabase, username: string): PublicDatabase {
  return {
    ...db,
    cheatExeBannedUsers: db.cheatExeBannedUsers.filter(
      (b) => b.username.toLowerCase() !== username.toLowerCase(),
    ),
  };
}
