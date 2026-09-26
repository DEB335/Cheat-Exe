"use client";

import { useCallback } from "react";

import { useLightMode } from "./use-external";
import { pageZoom } from "./zoom";

const STORAGE_KEY = "cheatExeTheme";

/**
 * Dark is the default; light is a `light-mode` class on <body>.
 * The switch animates as a circular reveal from the click point using
 * the View Transitions API, falling back to an instant swap.
 */
export function useTheme() {
  const light = useLightMode();

  const toggle = useCallback((event?: React.MouseEvent) => {
    const wasLight = document.body.classList.contains("light-mode");

    const apply = () => {
      document.body.classList.toggle("light-mode");
      const nowLight = document.body.classList.contains("light-mode");
      try {
        localStorage.setItem(STORAGE_KEY, nowLight ? "light" : "dark");
      } catch {
        /* storage unavailable -- the class swap still works */
      }
    };

    // Not in every browser yet; fall back to an instant swap.
    if (typeof document.startViewTransition !== "function") {
      apply();
      return;
    }

    // The click and the window are measured in real screen pixels, but
    // the root's transition snapshot inherits the page zoom, so its
    // clip-path lengths are zoomed CSS pixels. Unconverted, the circle
    // opened up and to the left of the click and never reached the far
    // corner on desktop.
    const zoom = pageZoom();
    const width = window.innerWidth / zoom;
    const height = window.innerHeight / zoom;
    const x = event ? event.clientX / zoom : width / 2;
    const y = event ? event.clientY / zoom : height / 2;
    const endRadius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));

    const transition = document.startViewTransition(apply);
    void transition.ready.then(() => {
      const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];
      document.documentElement.animate(
        { clipPath: wasLight ? clip : [...clip].reverse() },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: wasLight ? "::view-transition-new(root)" : "::view-transition-old(root)",
        },
      );
    });
  }, []);

  return { light, toggle };
}

/**
 * Runs before paint so a light-mode reload never flashes dark.
 * Injected as an inline script in the root layout.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  if(localStorage.getItem('${STORAGE_KEY}')==='light'){document.body.classList.add('light-mode');}
}catch(e){}})();
`;
