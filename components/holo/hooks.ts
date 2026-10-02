"use client";

import { useEffect, useId, type RefObject } from "react";

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Pauses every CSS animation inside `ref` while it is off screen or the
 * tab is hidden, by setting data-holo-paused on it (each holo stylesheet
 * pauses its animations under that attribute). The animations are all
 * transform/opacity, so they cost the compositor rather than paint --
 * but an idle page should cost nothing at all.
 *
 * One observer and one visibility listener serve every hologram on the
 * page.
 */
export function usePauseWhenHidden(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pauser.add(el);
    return () => pauser.remove(el);
  }, [ref]);
}

const pauser = (() => {
  const onScreen = new WeakMap<Element, boolean>();
  const watched = new Set<HTMLElement>();
  let io: IntersectionObserver | null = null;

  const apply = (el: HTMLElement) => {
    const paused = document.hidden || onScreen.get(el) === false;
    if (paused) el.dataset.holoPaused = "";
    else delete el.dataset.holoPaused;
  };
  const applyAll = () => watched.forEach(apply);

  return {
    add(el: HTMLElement) {
      if (!io) {
        io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            onScreen.set(entry.target, entry.isIntersecting);
            apply(entry.target as HTMLElement);
          }
        });
        document.addEventListener("visibilitychange", applyAll);
      }
      watched.add(el);
      io.observe(el);
      apply(el);
    },
    remove(el: HTMLElement) {
      watched.delete(el);
      io?.unobserve(el);
      delete el.dataset.holoPaused;
      if (!watched.size && io) {
        io.disconnect();
        io = null;
        document.removeEventListener("visibilitychange", applyAll);
      }
    },
  };
})();

/**
 * One animation clock for every particle canvas on the page, at 30fps.
 * The canvases normally draw in the particle worker, which runs its own
 * copy of this clock; this one serves them on the main thread only where
 * OffscreenCanvas is missing (particle-canvas.ts).
 *
 * The canvases' motion is slow enough that more frames buy nothing
 * visible, and on an integrated GPU every canvas frame is paid for
 * twice: drawing it and compositing the page again. So the clock runs
 * at 30fps whether or not the pointer is on a canvas, and sleeps on a
 * timer between frames -- the page is not woken 60 times a second for
 * frames that would draw nothing. Every canvas draws on the same tick,
 * so a stage's back and front layers land in the same composited frame
 * instead of alternating between two.
 *
 * Subscribers draw on every tick, with the frame's timestamp, and must
 * keep their motion on elapsed time rather than per-frame steps. Returns
 * the unsubscribe.
 */
export function onFrame(tick: (now: number) => void): () => void {
  frames.subs.add(tick);
  frames.wake();
  return () => {
    frames.subs.delete(tick);
    if (!frames.subs.size) frames.sleep();
  };
}

const FRAME_MS = 1000 / 30;

const frames = (() => {
  const subs = new Set<(now: number) => void>();
  let raf = 0;
  let timer = 0;

  const run = (now: number) => {
    raf = 0;
    for (const tick of subs) tick(now);
    if (!subs.size) return;
    // Wake three quarters of the way to the next frame and take the
    // vsync after it: at 60Hz that is exactly every other frame, and the
    // frames in between are never requested.
    const spent = performance.now() - now;
    timer = window.setTimeout(
      () => {
        timer = 0;
        raf = requestAnimationFrame(run);
      },
      Math.max(0, FRAME_MS * 0.75 - spent),
    );
  };

  return {
    subs,
    /** Start the clock, or bring a sleeping one forward to the next frame. */
    wake() {
      if (raf) return;
      window.clearTimeout(timer);
      timer = 0;
      raf = requestAnimationFrame(run);
    },
    sleep() {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      raf = timer = 0;
    },
  };
})();

/**
 * SVG ids must be unique on the page, and useId's punctuation is not
 * safe inside url(#...), so keep only the plain characters.
 */
export function useSvgIds(prefix: string) {
  const uid = `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return {
    id: (name: string) => `${uid}-${name}`,
    url: (name: string) => `url(#${uid}-${name})`,
  };
}
