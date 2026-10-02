"use client";

import { useEffect, useReducer, useRef } from "react";

import { driveCanvas } from "@/components/holo/particle-canvas";
import { cn } from "@/lib/utils";
import { pageZoom } from "@/lib/zoom";

import { createGlobeScene, type GlobeConfig } from "./globe-scene";

const MAX_DPR = 2;

interface ParticleGlobeProps {
  className?: string;
  /** Sphere centre as fractions of the canvas box (y may run past 1). */
  cx?: number;
  cy?: number;
  /** Sphere radius as a fraction of the canvas height. */
  radius?: number;
}

/**
 * A rotating 3D globe drawn on a canvas: a fibonacci lattice of points
 * with depth shading, faint meridians and parallels, a wired network of
 * hubs, a rim of atmosphere, and tilted orbit rings with chips riding
 * them (the drawing is globe-scene.ts). It turns at its own steady pace
 * and does not react to the pointer.
 *
 * Decorative only, and it acts like it: no clicks, one still frame for
 * reduced-motion users, and the loop stops whenever the tab is hidden or
 * the canvas is scrolled off screen. Every frame is drawn by the page's
 * particle worker (particle-canvas.ts), so the main thread pays nothing
 * for the spin.
 */
export function ParticleGlobe({ className, cx = 0.5, cy = 0.5, radius = 0.42 }: ParticleGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A canvas can be handed to the worker only once; when an element
  // cannot be reused, the effect asks for a brand-new one.
  const [generation, remount] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const config: GlobeConfig = { radius };

    // Drawn in the page's zoomed px, so the chips and hairlines shrink with
    // the rest of the page; the backing store is the real screen size
    // (the rect) times the device ratio, so it stays sharp.
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const zoom = pageZoom();
      const width = Math.max(1, rect.width / zoom);
      const height = Math.max(1, rect.height / zoom);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      return {
        width,
        height,
        pixelWidth: Math.max(1, Math.round(rect.width * dpr)),
        pixelHeight: Math.max(1, Math.round(rect.height * dpr)),
        ox: width * cx,
        oy: height * cy,
      };
    };

    return driveCanvas(canvas, {
      kind: "globe",
      config,
      measure,
      onScreen: false,
      local: createGlobeScene,
      remount,
    });
  }, [generation, cx, cy, radius]);

  return (
    <canvas key={generation} ref={canvasRef} aria-hidden className={cn("pointer-events-none block size-full", className)} />
  );
}
