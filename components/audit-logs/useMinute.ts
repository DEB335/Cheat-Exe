"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribeToMinute(notify: () => void): () => void {
  const timer = window.setInterval(notify, MINUTE);
  // A sleeping laptop does not fire timers on time; catch up on wake.
  const onVisible = () => {
    if (!document.hidden) notify();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const minuteOnClient = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const minuteOnServer = () => null;

/**
 * The current time rounded down to the minute, or null until the client
 * has mounted. "Last 24 hours" needs a clock, and Date.now() during
 * render would differ between the server and the hydrating client;
 * minute granularity keeps the snapshot stable between renders while a
 * tab left open still rolls old entries out of the window.
 */
export function useMinute(): number | null {
  return useSyncExternalStore(subscribeToMinute, minuteOnClient, minuteOnServer);
}
