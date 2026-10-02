"use client";

import { useSyncExternalStore } from "react";

/**
 * The latest round trip to this app's own server, in milliseconds, or
 * null before the first one lands (or when the last one failed).
 *
 * The shell's session poll already makes one small request every five
 * seconds while the tab is visible, so it times that request and
 * publishes the figure here. The ping pill on the overview only reads
 * it: it used to time a request of its own to the very same endpoint,
 * which was a second poll for a number the first one already had.
 */
let latest: number | null = null;
const listeners = new Set<() => void>();

export function publishPing(ms: number | null): void {
  const next = ms === null ? null : Math.round(ms);
  if (next === latest) return;
  latest = next;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

const read = () => latest;
const readOnServer = () => null;

export function usePing(): number | null {
  return useSyncExternalStore(subscribe, read, readOnServer);
}
