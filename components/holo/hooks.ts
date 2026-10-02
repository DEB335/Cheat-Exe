"use client";

import { useEffect, useId, type RefObject } from "react";

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * The element whose pointer movement should steer a hologram. The
 * holograms themselves are pointer-events: none (they sit behind a
 * panel's buttons and must never take a click), and an element that
 * ignores the pointer never hears about it either -- so walk up to the
 * first ancestor that does take it: normally the panel.
 */
export function findPointerHost(from: HTMLElement): HTMLElement {
  let el: HTMLElement | null = from;
  while (el && el !== document.body) {
    if (getComputedStyle(el).pointerEvents !== "none") return el;
    el = el.parentElement;
  }
  return document.body;
}

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
 * Leans a hologram toward the pointer through two custom properties,
 * --hx and --hy (-1..1, relative to the element's centre and scaled to
 * the host's half-size), which the holo objects fold into their tilt.
 *
 * Written straight to the style at most once a frame, and only while
 * the pointer is actually moving over the host, so a sweep across the
 * panel never re-renders React. CSS transitions on the objects do the
 * easing, so there is no animation loop to keep alive.
 */
export function usePointerLean(ref: RefObject<HTMLElement | null>, hostRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const host = hostRef?.current ?? findPointerHost(el);
    const reduced = window.matchMedia(REDUCED_MOTION);

    let raf = 0;
    let x = 0;
    let y = 0;
    let inside = false;

    // Both rects are real screen px, and so is the pointer; only ratios
    // are used, so the page zoom cancels out.
    const write = () => {
      raf = 0;
      if (!inside || reduced.matches) {
        el.style.removeProperty("--hx");
        el.style.removeProperty("--hy");
        return;
      }
      const box = el.getBoundingClientRect();
      const area = host.getBoundingClientRect();
      if (!area.width || !area.height) return;
      const hx = clamp((x - (box.left + box.width / 2)) / (area.width / 2));
      const hy = clamp((y - (box.top + box.height / 2)) / (area.height / 2));
      el.style.setProperty("--hx", hx.toFixed(3));
      el.style.setProperty("--hy", hy.toFixed(3));
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      inside = true;
      x = event.clientX;
      y = event.clientY;
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onLeave = () => {
      inside = false;
      if (!raf) raf = requestAnimationFrame(write);
    };

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      el.style.removeProperty("--hx");
      el.style.removeProperty("--hy");
    };
  }, [ref, hostRef]);
}

/**
 * One animation clock for every particle canvas on the page, at 30fps.
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

function clamp(v: number) {
  return Math.min(1, Math.max(-1, v));
}
