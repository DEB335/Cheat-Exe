"use client";

import { useEffect } from "react";

import { useDashboard } from "./store";

/** How often an open panel asks the server to free unlocked keys. */
const SWEEP_MS = 20_000;

/**
 * Keeps unlocked keys unlocked while someone has the panel open.
 *
 * The provider binds every key to the first device that uses it and has
 * no switch to stop that, so an unlocked key is one this panel keeps
 * releasing: /api/keys/hwid-sweep looks each one up and resets its HWID
 * when it finds one bound. The database cron makes the same call every
 * 30 seconds for when nobody is signed in; this only shortens the wait
 * while somebody is.
 *
 * Runs only when there is something to do -- the store holds at least
 * one key with `hwidLock === false` -- and only in a tab someone is
 * looking at, sweeping straight away and then on the interval. Fire and
 * forget: plain fetch rather than postJson, because a failed sweep is
 * not worth a toast and a 401 here must not bounce anyone to the login
 * page; the session poll owns that. The server throttles overlapping
 * sweeps, so several open tabs cost no more than one.
 */
export function useHwidSweep(): void {
  const needed = useDashboard((s) => s.db.cheatExeKeyHistory.some((k) => k.hwidLock === false));

  useEffect(() => {
    if (!needed) return;

    const sweep = () => {
      void fetch("/api/keys/hwid-sweep", { method: "POST", cache: "no-store" }).catch(() => {
        /* the next tick, or the cron, tries again */
      });
    };

    let id = 0;
    const start = () => {
      if (id) return;
      sweep();
      id = window.setInterval(sweep, SWEEP_MS);
    };
    const stop = () => {
      if (id) {
        window.clearInterval(id);
        id = 0;
      }
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [needed]);
}
