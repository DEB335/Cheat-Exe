"use client";

import { useEffect, useReducer, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { pageZoom } from "@/lib/zoom";

import { createFieldScene, type FieldConfig, type FieldLayer, type FieldShape } from "./field-scene";
import { PALETTES, resolvePalette, type PaletteInput, type PaletteName, type RGB } from "./palettes";
import { driveCanvas } from "./particle-canvas";

export type { FieldLayer, FieldShape } from "./field-scene";

/*
 * A 3D particle volume on a canvas, for the holograms' sparkle: tiny
 * sharp specks, glowing dots, four-point star glints that flash, and a
 * few big out-of-focus bokeh discs (the drawing is field-scene.ts).
 *
 * The drawing follows the old login card's particle field: positions
 * are a pure function of a shared clock, so two fields with the same
 * props -- a stage's back and front layers -- stay in lockstep without
 * talking to each other.
 *
 * Cost: none on the main thread. The canvas is handed to the page's
 * particle worker (particle-canvas.ts), which draws every field on one
 * shared 30fps clock; the main thread only reports the box's size and
 * whether the field is on screen. The field moves on its own and does
 * not follow the pointer.
 */

export interface ParticleFieldProps {
  /** A named palette or the particle colours themselves. Default "aurora". */
  palette?: PaletteInput;
  /** Particle count multiplier. 1 suits a ~420x300 hero box. */
  density?: number;
  /**
   * "orbit": a thick swirl circling the centre on tilted ellipses.
   * "column": a slowly turning cylinder of motes drifting upward.
   * "dome": a turning sphere shell around the centre.
   */
  shape?: FieldShape;
  /** Centre of the field as fractions of the box. Ignored when anchorRef is set. */
  cx?: number;
  cy?: number;
  /** Centre the field on this element instead (measured on resize). */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Field radius as a fraction of the box's shorter side. */
  radius?: number;
  /** Vertical spread of the orbit cloud, as a multiple of its default thickness. */
  spread?: number;
  /** Motion speed multiplier. */
  speed?: number;
  /**
   * Which depth slice to draw: "back" is everything behind the centre
   * plane and "front" everything before it, so a stage can put a
   * floating object between two fields. Particles crossing the plane
   * cross-fade between the two, so the seam never shows.
   */
  layer?: FieldLayer;
  /** Layout seed; two fields with the same props and seed draw the same particles. */
  seed?: number;
  /**
   * Fade the particles out toward the box's edges, so a field smaller
   * than its panel has no visible rectangle round it.
   */
  edgeFade?: boolean;
  className?: string;
}

/**
 * The shared clock's zero, in absolute ms. Fixed when the module loads,
 * so every field on the page -- and both layers of a stage -- read the
 * same time, on whichever thread draws them.
 */
const EPOCH = typeof performance !== "undefined" ? performance.timeOrigin + performance.now() : 0;

const MAX_DPR = 2;

export function ParticleField({
  palette = "aurora",
  density = 1,
  shape = "orbit",
  cx = 0.5,
  cy = 0.5,
  anchorRef,
  radius = 0.46,
  spread = 1,
  speed = 1,
  layer = "all",
  seed = 0x401d_5eed,
  edgeFade = false,
  className,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A canvas can be handed to the worker only once; when an element
  // cannot be reused, the effect asks for a brand-new one.
  const [generation, remount] = useReducer((n: number) => n + 1, 0);
  // An inline array would be a new object every render; key the effect
  // on the colours themselves.
  const paletteKey = typeof palette === "string" ? palette : palette.map((c) => c.join(",")).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pal = resolvePalette(paletteKey in PALETTES ? (paletteKey as PaletteName) : paletteFromKey(paletteKey));
    const config: FieldConfig = {
      colors: [...pal.particles, pal.hot],
      shape,
      density,
      seed,
      spread,
      radius,
      speed,
      layer,
      epoch: EPOCH,
    };

    // Drawn in the box's CSS px. offsetWidth is that whatever the page
    // zoom or any hover transform on the panel; the backing store is the
    // real on-screen size (CSS px x zoom) times the device ratio, so it
    // is exactly as sharp as the screen and no bigger.
    const measure = () => {
      const width = Math.max(1, canvas.offsetWidth);
      const height = Math.max(1, canvas.offsetHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const zoom = pageZoom();
      let ox = width * cx;
      let oy = height * cy;
      const anchor = anchorRef?.current;
      if (anchor) {
        // Both rects are real px; as fractions of the canvas the zoom cancels.
        const box = canvas.getBoundingClientRect();
        const at = anchor.getBoundingClientRect();
        if (box.width && box.height) {
          ox = ((at.left + at.width / 2 - box.left) / box.width) * width;
          oy = ((at.top + at.height / 2 - box.top) / box.height) * height;
        }
      }
      return {
        width,
        height,
        pixelWidth: Math.max(1, Math.round(width * zoom * dpr)),
        pixelHeight: Math.max(1, Math.round(height * zoom * dpr)),
        ox,
        oy,
      };
    };

    return driveCanvas(canvas, {
      kind: "field",
      config,
      measure,
      watch: anchorRef?.current,
      onScreen: true,
      local: createFieldScene,
      remount,
    });
  }, [generation, paletteKey, density, shape, cx, cy, anchorRef, radius, spread, speed, layer, seed]);

  return (
    <canvas
      key={generation}
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 block size-full", className)}
      style={edgeFade ? EDGE_FADE : undefined}
    />
  );
}

// A static mask: the compositor applies it, the canvas never redraws for it.
const EDGE_FADE_MASK = "radial-gradient(farthest-side, #000 58%, transparent)";
const EDGE_FADE = { WebkitMaskImage: EDGE_FADE_MASK, maskImage: EDGE_FADE_MASK } as const;

/**
 * Rebuilds an RGB list from paletteKey. The effect works from the key
 * alone, so an inline palette array (a new object every render) never
 * restarts the loop.
 */
function paletteFromKey(key: string): RGB[] {
  return key.split("|").map((c) => {
    const [r = 0, g = 0, b = 0] = c.split(",").map(Number);
    return [r, g, b] as const;
  });
}
