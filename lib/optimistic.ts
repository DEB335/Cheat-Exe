"use client";

import type { PublicAnnouncement, PublicDatabase } from "./types";

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
