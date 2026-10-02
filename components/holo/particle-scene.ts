/*
 * The contract between a particle canvas's drawing (a "scene": the
 * hologram particle field, the network globe) and whatever drives it.
 *
 * Normally that is the shared particle worker (particles.worker.ts),
 * which owns the canvas through transferControlToOffscreen and runs the
 * 30fps loop off the main thread; on a browser without OffscreenCanvas
 * it is the main thread's onFrame clock (particle-canvas.ts). Both drive
 * the same scene code, so there is one implementation of each drawing.
 *
 * Nothing in here may touch the DOM or React: the worker imports it.
 */

/**
 * "run": a frame of the live animation. "still": the loop is paused (off
 * screen, tab hidden), draw the moment as it stands. "reduced": the one
 * frozen frame shown to anyone who asked for reduced motion.
 */
export type SceneMode = "run" | "still" | "reduced";

export interface SceneSize {
  /** The box in CSS px: the drawing is laid out in these. */
  width: number;
  height: number;
  /** The backing store, in device px. */
  pixelWidth: number;
  pixelHeight: number;
  /** The scene's centre, in CSS px from the box's top left. */
  ox: number;
  oy: number;
}

export interface ParticleScene {
  /** Resizes the backing store (which clears it); the caller draws next. */
  resize(size: SceneSize): void;
  /**
   * Draws one frame. `now` is absolute time in ms (performance.timeOrigin
   * + performance.now()), so the main thread and a worker share a clock.
   */
  draw(now: number, light: boolean, mode: SceneMode): void;
}

/** A 2D context from either a DOM canvas or an OffscreenCanvas. */
export type Context2D = Omit<OffscreenCanvasRenderingContext2D, "canvas">;

/** The canvas a scene draws into: a DOM canvas, or an OffscreenCanvas in the worker. */
export interface Surface {
  width: number;
  height: number;
}

/** A sprite or atlas canvas: something drawImage takes, with its size. */
export type SpriteCanvas = CanvasImageSource & Surface;

/**
 * A scratch canvas for a sprite or atlas: a DOM canvas on the main
 * thread (as the scenes always used), an OffscreenCanvas in a worker.
 */
export function spriteCanvas(width: number, height: number): { canvas: SpriteCanvas; g: Context2D | null } {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, g: canvas.getContext("2d") };
  }
  const canvas = new OffscreenCanvas(width, height);
  return { canvas, g: canvas.getContext("2d") };
}

export type SceneKind = "field" | "globe";

/** Main thread -> particle worker. */
export type ToWorker =
  | {
      op: "add";
      id: number;
      kind: SceneKind;
      /** The scene's own settings (FieldConfig / GlobeConfig). */
      config: unknown;
      /** Transferred the first time only; a re-add (React remounting the same element) reuses it. */
      canvas?: OffscreenCanvas;
      size: SceneSize;
      mode: SceneMode;
      light: boolean;
    }
  | { op: "size"; id: number; size: SceneSize }
  | { op: "mode"; id: number; mode: SceneMode }
  | { op: "light"; light: boolean }
  /** keep: stop drawing but hold the canvas, in case React mounts the same element again. */
  | { op: "remove"; id: number; keep: boolean };

/** Particle worker -> main thread: this canvas cannot be drawn there (no 2D OffscreenCanvas). */
export type FromWorker = { op: "lost"; id: number };
