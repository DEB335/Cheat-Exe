import { onFrame, REDUCED_MOTION } from "./hooks";
import type { FromWorker, ParticleScene, SceneKind, SceneMode, SceneSize, ToWorker } from "./particle-scene";

/*
 * Runs a particle canvas (ParticleField, ParticleGlobe) off the main
 * thread.
 *
 * The canvas is handed to the page's one particle worker with
 * transferControlToOffscreen, and the worker owns its drawing and its
 * 30fps loop. All the main thread still does is tell it what changed:
 * the box's size (a ResizeObserver, plus window resizes for the zoom
 * breakpoint), whether it should be running at all (on screen, tab
 * visible, motion allowed) and the theme. Nothing here follows the
 * pointer; the canvases move on their own.
 *
 * Where OffscreenCanvas is missing (older Safari), or the worker fails,
 * the same scene is drawn on the main thread from the shared onFrame
 * clock instead, exactly as it always was.
 *
 * A canvas can be transferred only once. React's Strict Mode and a
 * change of props both unmount and remount on the same element, so a
 * transferred element stays with the worker for a moment after its
 * effect is cleaned up and is picked up again if it comes straight back.
 * If it comes back later than that (its worker already gone, or this
 * module hot-reloaded), the component is asked to render a fresh canvas.
 */

export interface DriveOptions<C> {
  kind: SceneKind;
  /** The scene's settings: plain data, posted to the worker. */
  config: C;
  /** Reads the layout (main thread only). Called on mount and on every resize. */
  measure(): SceneSize;
  /** Another element whose resize moves the scene (a field's anchor). */
  watch?: Element | null;
  /** Whether to run before the IntersectionObserver's first report. */
  onScreen: boolean;
  /** Builds the scene on the main thread, when the worker cannot have the canvas. */
  local(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, config: C): ParticleScene;
  /** This element cannot be drawn on any more: render a new <canvas> in its place. */
  remount(): void;
}

/** Where a canvas's frames go: the worker, or a scene on this thread. */
interface Target {
  resize(size: SceneSize): void;
  setMode(mode: SceneMode): void;
  close(): void;
}

/** Starts a particle canvas; returns its teardown. Call from an effect. */
export function driveCanvas<C>(canvas: HTMLCanvasElement, options: DriveOptions<C>): () => void {
  const reduced = window.matchMedia(REDUCED_MOTION);
  let onScreen = options.onScreen;
  const mode = (): SceneMode => (reduced.matches ? "reduced" : onScreen && !document.hidden ? "run" : "still");

  const target = connect(canvas, options, options.measure(), mode());
  if (!target) {
    if (!handedOff.has(canvas)) return () => {};
    // Already handed to a worker that is gone. Asked from a task, so the
    // remount is a separate render rather than a state change mid-effect.
    const task = window.setTimeout(options.remount);
    return () => window.clearTimeout(task);
  }

  const sync = () => target.setMode(mode());
  const onResize = () => target.resize(options.measure());

  const resize = new ResizeObserver(onResize);
  const visible = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting);
    sync();
  });

  resize.observe(canvas);
  if (options.watch) resize.observe(options.watch);
  visible.observe(canvas);
  // Crossing the zoom breakpoint, or a browser zoom, changes the real
  // size without always changing the CSS size the observer watches.
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);

  return () => {
    resize.disconnect();
    visible.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", sync);
    reduced.removeEventListener("change", sync);
    target.close();
  };
}

function connect<C>(canvas: HTMLCanvasElement, options: DriveOptions<C>, size: SceneSize, mode: SceneMode): Target | null {
  if (!drawnHere.has(canvas) && workerUsable()) {
    const target = workerTarget(canvas, options, size, mode);
    if (target !== "fallback") return target;
  }
  // A canvas the worker owns cannot get a context here any more.
  if (handedOff.has(canvas)) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawnHere.add(canvas);
  return localTarget(options.local(canvas, ctx, options.config), size, mode);
}

// ---- Main-thread fallback ---------------------------------------------

/** Canvases drawn on the main thread: once a context exists, never transferable. */
const drawnHere = new WeakSet<HTMLCanvasElement>();

const isLight = () => document.body.classList.contains("light-mode");
const now = () => performance.timeOrigin + performance.now();

function localTarget(scene: ParticleScene, size: SceneSize, initial: SceneMode): Target {
  let mode = initial;
  let unsubscribe: (() => void) | null = null;
  const tick = (at: number) => scene.draw(performance.timeOrigin + at, isLight(), "run");

  scene.resize(size);
  scene.draw(now(), isLight(), mode);
  if (mode === "run") unsubscribe = onFrame(tick);

  return {
    resize(next) {
      scene.resize(next);
      scene.draw(now(), isLight(), mode);
    },
    setMode(next) {
      mode = next;
      if (next === "run") {
        unsubscribe ??= onFrame(tick);
      } else {
        unsubscribe?.();
        unsubscribe = null;
        scene.draw(now(), isLight(), next);
      }
    },
    close() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

// ---- The worker ---------------------------------------------------------

/** How long the worker outlives its last canvas, so a route change can reuse it. */
const IDLE_MS = 2000;

const holder = globalThis as typeof globalThis & { __particleCanvases?: WeakSet<HTMLCanvasElement> };
/**
 * Every canvas ever handed to a worker. On globalThis, so a hot-reloaded
 * copy of this module still knows not to transfer (or draw on) one again.
 */
const handedOff = (holder.__particleCanvases ??= new WeakSet<HTMLCanvasElement>());

interface Link {
  id: number;
  /** Between an effect's cleanup and the same element's next mount. */
  live: boolean;
  remount: () => void;
}

let worker: Worker | null = null;
/** The worker failed (would not load, or cannot draw): everything draws here from now on. */
let broken = false;
let nextId = 1;
let users = 0;
/** Counts workers, so a canvas's teardown only touches the worker it was given to. */
let era = 0;
let idleTimer = 0;
let light = false;
let theme: MutationObserver | null = null;
/** The canvases the current worker holds. */
let links = new Map<HTMLCanvasElement, Link>();

function workerUsable() {
  return (
    !broken &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype
  );
}

function post(message: ToWorker, transfer: Transferable[] = []) {
  worker?.postMessage(message, transfer);
}

/** Every canvas goes back to the main thread, on a fresh element. */
function fail() {
  broken = true;
  const lost = [...links.values()].filter((link) => link.live);
  shutdown();
  for (const link of lost) link.remount();
}

function shutdown() {
  window.clearTimeout(idleTimer);
  worker?.terminate();
  worker = null;
  theme?.disconnect();
  theme = null;
  links = new Map();
  users = 0;
  // Teardowns still to come belong to the worker just ended.
  era++;
}

function start(): Worker | null {
  window.clearTimeout(idleTimer);
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./particles.worker.ts", import.meta.url), { type: "module", name: "particles" });
  } catch {
    broken = true;
    return null;
  }
  worker.addEventListener("error", fail);
  worker.addEventListener("message", ({ data }: MessageEvent<FromWorker>) => {
    if (data.op === "lost") fail();
  });
  // The theme is a class on <body>; the worker hears when it flips.
  light = isLight();
  theme = new MutationObserver(() => {
    if (isLight() === light) return;
    light = !light;
    post({ op: "light", light });
  });
  theme.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return worker;
}

function workerTarget<C>(
  canvas: HTMLCanvasElement,
  options: DriveOptions<C>,
  size: SceneSize,
  initial: SceneMode,
): Target | "fallback" | null {
  let link = links.get(canvas);
  let transfer: OffscreenCanvas | undefined;
  if (!link) {
    // Handed to a worker that has since gone: only a new element will do.
    if (handedOff.has(canvas)) return null;
    if (!start()) return "fallback";
    try {
      transfer = canvas.transferControlToOffscreen();
    } catch {
      broken = true;
      return "fallback";
    }
    handedOff.add(canvas);
    link = { id: nextId++, live: true, remount: options.remount };
    links.set(canvas, link);
  } else {
    start();
    link.live = true;
    link.remount = options.remount;
  }
  users++;

  const { id } = link;
  const mine = era;
  let mode = initial;
  post(
    { op: "add", id, kind: options.kind, config: options.config, canvas: transfer, size, mode, light },
    transfer ? [transfer] : [],
  );

  return {
    resize(next) {
      if (mine === era) post({ op: "size", id, size: next });
    },
    setMode(next) {
      if (next === mode || mine !== era) return;
      mode = next;
      post({ op: "mode", id, mode: next });
    },
    close() {
      if (mine !== era) return;
      const current = link;
      current.live = false;
      post({ op: "remove", id, keep: true });
      // Strict Mode and a props change mount the same element again in
      // this same task; anything else is gone for good.
      window.setTimeout(() => {
        if (current.live || links.get(canvas) !== current) return;
        links.delete(canvas);
        post({ op: "remove", id, keep: false });
      });
      users--;
      if (users <= 0) {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(shutdown, IDLE_MS);
      }
    },
  };
}
