"use client";

import { useRef } from "react";

import {
  HoloPedestal,
  HoloShield,
  paletteVars,
  ParticleField,
  resolvePalette,
  usePauseWhenHidden,
  usePointerLean,
  type RGB,
} from "@/components/holo";
import { cn } from "@/lib/utils";

import { AuditGlints, AuditScreens, AuditStreaks, AuditTower } from "./audit-parts";
import styles from "./scene-audit.module.css";

/*
 * The Audit Logs hologram, top right of the System Audit Logs panel: a
 * glowing server tower with a glass padlock shield standing guard in
 * front of it, on the ringed holographic platform, with small glass
 * screens floating round it, data rising off the floor and sparkle all
 * about. Drawn at about 460 x 300; the caller places and sizes the root,
 * and everything inside is laid out in % and cqw of the largest box of
 * that aspect that fits, so it keeps its composition from roughly
 * two-thirds to one and a half times that size.
 *
 * Particle budget: one ParticleField split into a back and a front layer
 * at the tower (one field, like a HoloStage's), plus CSS glints.
 *
 * Decorative only: aria-hidden, no pointer events (the pointer is read
 * from the panel, so its buttons under the scene keep working), every
 * loop paused off screen or in a hidden tab and held still for reduced
 * motion.
 */

const CYAN = resolvePalette("cyan");

// Mostly cyan and blue like the mockup's sparkle, with the platform's
// magenta and violet mixed in and a near-white for the brightest specks.
const SPARKS: readonly RGB[] = [
  [103, 232, 249],
  [96, 165, 250],
  [255, 61, 242],
  [139, 92, 246],
  [224, 250, 255],
];

// Both layers must share one seed, or back and front would be two
// different fields rather than one field split at the tower.
const FIELD_SEED = 0xa0d1;

export function AuditScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  usePointerLean(rootRef);

  const field = (layer: "back" | "front") => (
    <ParticleField
      layer={layer}
      palette={SPARKS}
      shape="orbit"
      density={1.5}
      radius={0.5}
      seed={FIELD_SEED}
      anchorRef={anchorRef}
      edgeFade
    />
  );

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${styles.root} ${cn("pointer-events-none relative", className)}`}
      style={paletteVars(CYAN)}
    >
      {field("back")}
      <div className={styles.fit}>
        <div className={styles.halo} />
        <AuditScreens />
        <HoloPedestal tone="aurora" className={styles.pedestal} />
        <AuditStreaks />
        <div ref={anchorRef} className={styles.anchor} />
        <AuditTower />
        <div className={styles.shield}>
          <div className={styles.bob}>
            <HoloShield tone="cyan" glyph="lock" />
          </div>
        </div>
      </div>
      {field("front")}
      <div className={styles.fit}>
        <AuditGlints />
      </div>
    </div>
  );
}
