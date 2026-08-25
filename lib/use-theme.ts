"use client";

import { useCallback } from "react";

import { useLightMode } from "./use-external";

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

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

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
