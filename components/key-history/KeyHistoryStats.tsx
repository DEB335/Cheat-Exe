"use client";

import { useMemo, useSyncExternalStore } from "react";

import { CalendarIcon, KeyIcon } from "@/components/icons";
import { AlertTriangleIcon, InfinityIcon, NeonStat } from "@/components/neon";
import { keyValidity } from "@/lib/packages";
import { useDashboard } from "@/lib/store";
import { parseStamp } from "@/lib/trends";
import type { KeyRecord } from "@/lib/types";

/** Days each sparkline covers, oldest first, ending today. */
const SPAN = 14;
/**
 * Below this rise, as a share of the total, the running total gets no
 * line: the sparkline scales min to max, so one key on top of seven
 * would climb the tile's full height and read as a surge.
 */
const MIN_VISIBLE_RISE = 0.15;

/** Midnight at the start of `ms`'s local day, `offset` days on. */
function midnight(ms: number, offset = 0): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

/**
 * Wakes the tiles when the local day rolls over, so a tab left open
 * overnight moves its week on. The same subscription as lib/trends'
 * useToday, which that module keeps private.
 */
function subscribeToDay(notify: () => void): () => void {
  let timer = 0;
  const arm = () => {
    window.clearTimeout(timer);
    const now = Date.now();
    timer = window.setTimeout(() => {
      notify();
      arm();
    }, midnight(now, 1) - now + 1000);
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

const todayOnClient = () => midnight(Date.now());
const todayOnServer = () => null;

/**
 * The four figures over the key table, all counted from the rows below
 * them.
 *
 * The mockup's "Active" and "Expiring soon" are left out on purpose: a
 * key's clock starts when it is first used, and the provider reports no
 * real expiry for an unused one (see KeyRecord.expiry), so the panel
 * cannot know which keys are live or about to lapse. What it does know:
 * - Total keys: every row. The line is the running total at the end of
 *   each of the last 14 days, so it ends on the number printed. It is
 *   drawn flat or when the rise is at least MIN_VISIBLE_RISE of the
 *   total, and left out between.
 * - Last 7 days: rows stamped within the last seven local days, today
 *   included. The line is keys per day over the last 14.
 * - Lifetime keys: rows whose validity is confirmed as lifetime. An
 *   unconfirmed "Lifetime" is only what was asked for, so it is not
 *   counted. The line is those keys per day.
 * - Unconfirmed validity: rows whose validity was never confirmed --
 *   the italic ones in the table. They are all old keys, so no line.
 * A row whose date does not parse still counts in its total, just not in
 * any day.
 */
export function KeyHistoryStats({ records }: { records: KeyRecord[] }) {
  const loading = useDashboard((s) => s.loading);
  // Null on the server and while hydrating, the real day straight after:
  // reading the clock during render would let the two disagree.
  const today = useSyncExternalStore(subscribeToDay, todayOnClient, todayOnServer);

  const stats = useMemo(() => {
    const rows = records.map((record) => {
      const validity = keyValidity(record);
      return {
        at: parseStamp(record.date),
        lifetime: validity.certain && validity.label === "Lifetime",
        unconfirmed: !validity.certain,
      };
    });
    const lifetime = rows.filter((r) => r.lifetime);
    const unconfirmed = rows.filter((r) => r.unconfirmed).length;
    if (today === null) {
      return { total: rows.length, week: null, lifetime: lifetime.length, unconfirmed, series: null };
    }

    // Each day's local midnight, oldest first, plus tomorrow's to close
    // today. Stepped by calendar day, not by 24h, so a clock change in
    // the window does not shift every earlier day by an hour.
    const edges = Array.from({ length: SPAN + 1 }, (_, i) => midnight(today, i - (SPAN - 1)));
    const perDay = (list: typeof rows) => {
      const out = new Array<number>(SPAN).fill(0);
      for (const { at } of list) {
        // Negated, so an unparsed date (NaN) is skipped as well.
        if (!(at >= edges[0] && at < edges[SPAN])) continue;
        let day = 0;
        while (at >= edges[day + 1]) day++;
        out[day]++;
      }
      return out;
    };
    const created = perDay(rows);
    // Running total: everything, less whatever was stamped after that day ended.
    const running = created.map((_, i) => rows.length - rows.filter((r) => r.at >= edges[i + 1]).length);
    const rise = running[SPAN - 1] - running[0];

    return {
      total: rows.length,
      week: created.slice(-7).reduce((a, b) => a + b, 0),
      lifetime: lifetime.length,
      unconfirmed,
      series: {
        running: rise === 0 || rise / rows.length >= MIN_VISIBLE_RISE ? running : undefined,
        created,
        lifetime: perDay(lifetime),
      },
    };
  }, [records, today]);

  // Before the first load the store is empty; a zero there would be a
  // claim, a dash is not.
  const show = (value: number | null) => (loading || value === null ? "—" : value);
  const spark = (values: number[] | undefined) => (loading ? null : values);

  return (
    <div className="grid gap-4 @[620px]/khist:grid-cols-2 @[1180px]/khist:grid-cols-4 sm:gap-5">
      <NeonStat
        tone="violet"
        icon={<KeyIcon />}
        label="Total keys"
        value={show(stats.total)}
        spark={spark(stats.series?.running)}
        sparkLabel="Running total of keys over the last 14 days"
      />
      <NeonStat
        tone="blue"
        icon={<CalendarIcon />}
        label="Last 7 days"
        value={show(stats.week)}
        spark={spark(stats.series?.created)}
        sparkLabel="Keys generated per day over the last 14 days"
      />
      <NeonStat
        tone="green"
        icon={<InfinityIcon />}
        label="Lifetime keys"
        value={show(stats.lifetime)}
        spark={spark(stats.series?.lifetime)}
        sparkLabel="Confirmed lifetime keys generated per day over the last 14 days"
      />
      <NeonStat
        tone="amber"
        icon={<AlertTriangleIcon />}
        label="Unconfirmed validity"
        value={show(stats.unconfirmed)}
      />
    </div>
  );
}
