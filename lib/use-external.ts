"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "cheatexe:storage";

/**
 * A boolean backed by localStorage, read through useSyncExternalStore so
 * the server snapshot is stable and hydration does not warn. This is the
 * reason it is not simply a useEffect that calls setState.
 */
export function useStoredFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) notify();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(CHANGE_EVENT, notify);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, notify);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, set];
}

/** Tracks the `light-mode` class on <body> without polling. */
export function useLightMode(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.body.classList.contains("light-mode"),
    () => false,
  );
}
