import { createGlobeScene, type GlobeConfig } from "../effects/globe-scene";

import { createFieldScene, type FieldConfig } from "./field-scene";
import type { FromWorker, ParticleScene, SceneMode, ToWorker } from "./particle-scene";

/*
 * The particle worker: one per page, shared by every particle field and
 * globe on it (particle-canvas.ts starts it and ends it). Each canvas is
 * handed over once with transferControlToOffscreen, and from then on
 * every frame is drawn here, so the canvases never cost the main thread
 * a frame, a style recalc or a click's worth of delay.
 *
 * The loop is the main thread's onFrame clock moved over: 30fps, asleep
 * on a timer between frames, every canvas drawn on the same tick -- so a
 * stage's back and front layers land in the same frame -- and nothing
 * running at all while no canvas is on screen.
 */

interface Held {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  /** Null while React is between unmounting and remounting the element. */
  scene: ParticleScene | null;
  mode: SceneMode;
}

// The worker's global scope, typed by hand: the project compiles against
// the DOM lib, not the webworker one.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
  requestAnimationFrame?: (callback: (now: number) => void) => number;
};

const held = new Map<number, Held>();
let light = false;

/** Absolute time in ms, the clock the main thread uses too. */
const now = () => performance.timeOrigin + performance.now();

const FRAME_MS = 1000 / 30;
let raf = 0;
let timer = 0;

const frame = (at: number) => {
  raf = 0;
  const time = performance.timeOrigin + at;
  let running = false;
  for (const h of held.values()) {
    if (!h.scene || h.mode !== "run") continue;
    h.scene.draw(time, light, "run");
    running = true;
  }
  if (!running) return;
  // Wake three quarters of the way to the next frame and take the
  // vsync after it: at 60Hz that is exactly every other frame. Without
  // a worker rAF (older engines), a plain 30fps timer.
  const spent = performance.now() - at;
  if (scope.requestAnimationFrame) {
    timer = self.setTimeout(() => {
      timer = 0;
      raf = scope.requestAnimationFrame!(frame);
    }, Math.max(0, FRAME_MS * 0.75 - spent));
  } else {
    timer = self.setTimeout(() => {
      timer = 0;
      frame(performance.now());
    }, Math.max(0, FRAME_MS - spent));
  }
};

/** Start the loop, or bring a sleeping one forward to the next frame. */
const wake = () => {
  if (raf) return;
  self.clearTimeout(timer);
  timer = 0;
  if (scope.requestAnimationFrame) raf = scope.requestAnimationFrame(frame);
  else timer = self.setTimeout(() => frame(performance.now()), 0);
};

scope.onmessage = ({ data: msg }) => {
  switch (msg.op) {
    case "add": {
      const old = held.get(msg.id);
      const canvas = msg.canvas ?? old?.canvas;
      if (!canvas) return;
      const ctx = old?.ctx ?? canvas.getContext("2d");
      if (!ctx) {
        scope.postMessage({ op: "lost", id: msg.id });
        return;
      }
      const scene =
        msg.kind === "field"
          ? createFieldScene(canvas, ctx, msg.config as FieldConfig)
          : createGlobeScene(canvas, ctx, msg.config as GlobeConfig);
      held.set(msg.id, { canvas, ctx, scene, mode: msg.mode });
      light = msg.light;
      scene.resize(msg.size);
      scene.draw(now(), light, msg.mode);
      if (msg.mode === "run") wake();
      return;
    }
    case "size": {
      const h = held.get(msg.id);
      if (!h?.scene) return;
      h.scene.resize(msg.size);
      h.scene.draw(now(), light, h.mode);
      return;
    }
    case "mode": {
      const h = held.get(msg.id);
      if (!h?.scene || h.mode === msg.mode) return;
      h.mode = msg.mode;
      // A paused canvas shows the moment it stopped (or the frozen
      // reduced-motion frame); a running one waits for the next tick.
      if (msg.mode === "run") wake();
      else h.scene.draw(now(), light, msg.mode);
      return;
    }
    case "light": {
      light = msg.light;
      // Running canvases pick it up on their next frame.
      for (const h of held.values()) if (h.scene && h.mode !== "run") h.scene.draw(now(), light, h.mode);
      return;
    }
    case "remove": {
      if (!msg.keep) held.delete(msg.id);
      else {
        const h = held.get(msg.id);
        if (h) h.scene = null;
      }
      return;
    }
  }
};
