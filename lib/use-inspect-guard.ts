"use client";

import { useEffect, useRef } from "react";

/** The three developer-tools panels, by physical key. */
const DEVTOOLS_KEYS = ["KeyI", "KeyJ", "KeyC"];

/**
 * Whether this keystroke is one of the browser's routes into developer
 * tools or the page source.
 *
 * Matched on `event.code`, which names the physical key whatever the
 * layout, rather than `event.key`. On macOS the shortcut carries Option,
 * and Option turns `key` into the character it would type -- Cmd+Option+I
 * arrives as "ˆ", not "I" -- so a `key` comparison misses the Mac
 * shortcuts entirely and passes them straight through.
 */
function opensDevTools(event: KeyboardEvent): boolean {
  if (event.code === "F12") return true;

  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return false;

  const panel = DEVTOOLS_KEYS.includes(event.code);

  // Windows and Linux: Ctrl+Shift+<key>. macOS: Cmd+Option+<key>.
  //
  // Ctrl+Alt is deliberately not treated as the macOS form. Windows
  // reports AltGr as Ctrl+Alt, so matching it here would swallow
  // characters people genuinely type -- AltGr+C is a real key on several
  // European layouts -- and a login form that silently eats a keystroke
  // is a worse bug than the one this is guarding against.
  if (event.shiftKey && panel) return true;
  if (event.metaKey && event.altKey && panel) return true;

  // View source: a way to read the markup without opening the panel.
  return !event.shiftKey && !event.altKey && event.code === "KeyU";
}

/**
 * Turns away the usual ways into the inspector, and says so.
 *
 * Worth being honest about what this is. Developer tools belong to the
 * browser, not to the page, and the page runs inside the thing being
 * inspected -- so this is a closed door, not a locked one. It does
 * nothing about the menu route (More Tools -> Developer Tools), about
 * opening the tools before loading the panel, about `view-source:` typed
 * directly, or about someone turning JavaScript off, which removes these
 * handlers along with everything else. Browsers also reserve some of
 * these combinations at a level a page cannot cancel, and which ones
 * varies by browser and version.
 *
 * None of that makes it useless -- it stops the casual press of F12, and
 * the toast makes clear the panel would rather you did not -- but it is
 * not what keeps anything safe. That is /api/db, which scopes every
 * response to the account asking, so a reseller with the inspector wide
 * open still receives nothing belonging to anyone else.
 *
 * The callback is held in a ref, as in useRealtimePing, so passing an
 * inline function does not rebuild the listeners on every render.
 */
export function useInspectGuard(notify: (message: string) => void): void {
  const handler = useRef(notify);
  useEffect(() => {
    handler.current = notify;
  }, [notify]);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      handler.current("Right click is disabled on this panel!");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!opensDevTools(event)) return;
      event.preventDefault();
      handler.current("Inspect is disabled on this panel!");
    };

    // Capture, so a field that stops the event bubbling cannot leave a
    // shortcut unhandled. The flag has to match on removal.
    const options = { capture: true } as const;

    document.addEventListener("contextmenu", onContextMenu, options);
    document.addEventListener("keydown", onKeyDown, options);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, options);
      document.removeEventListener("keydown", onKeyDown, options);
    };
  }, []);
}
