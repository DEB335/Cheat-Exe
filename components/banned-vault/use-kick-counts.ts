"use client";

import { useMemo, useSyncExternalStore } from "react";

import { parseStamp } from "@/lib/trends";
import type { BannedUser } from "@/lib/types";

/** Midnight at the start of the viewer's local day, as epoch ms. */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Re-reads the clock once a minute and on coming back to the tab. The
// snapshot is a whole day, so it only changes at midnight and nothing
// re-renders in between -- a tab left open overnight still rolls over.
function subscribe(notify: () => void): () => void {
  const timer = window.setInterval(notify, 60_000);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", notify);
  };
}

const noDayOnServer = () => null;

/**
 * How many vault records were kicked today, and over the last seven
 * days (today and the six before it), by the viewer's calendar, read
 * from each record's kickedTime. A stamp that does not parse counts in
 * neither -- a guessed date would make the figure up.
 *
 * Null until the client has mounted: the server renders with its own
 * clock and an empty store, and reading Date.now() during that render
 * would let the two disagree across midnight.
 */
export function useKickCounts(records: BannedUser[]): { today: number; week: number } | null {
  const today = useSyncExternalStore(subscribe, startOfToday, noDayOnServer);

  return useMemo(() => {
    if (today === null) return null;
    // setDate rather than 6 x 24h, so a clock change inside the week
    // does not move the boundary off midnight.
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const weekStart = start.getTime();

    let kickedToday = 0;
    let kickedThisWeek = 0;
    for (const record of records) {
      const at = parseStamp(record.kickedTime);
      if (at >= today) kickedToday += 1;
      if (at >= weekStart) kickedThisWeek += 1;
    }
    return { today: kickedToday, week: kickedThisWeek };
  }, [records, today]);
}
