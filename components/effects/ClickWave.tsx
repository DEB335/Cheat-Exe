"use client";

import { pageZoom } from "@/lib/zoom";

/**
 * Expanding neon ring emitted from a collapsed sidebar icon on click.
 * Kept imperative because the element must outlive the click handler and
 * remove itself when the animation ends.
 */
export function emitClickWave(element: HTMLElement, color: string) {
  // The rect is in real screen px; the wave's style lengths are zoomed.
  const zoom = pageZoom();
  const rect = element.getBoundingClientRect();
  const wave = document.createElement("div");

  wave.className = "click-wave";
  wave.style.left = `${(rect.left + rect.width / 2) / zoom}px`;
  wave.style.top = `${(rect.top + rect.height / 2) / zoom}px`;
  wave.style.width = `${rect.width / zoom}px`;
  wave.style.height = `${rect.width / zoom}px`;
  wave.style.setProperty("--wave-color", color);

  document.body.appendChild(wave);
  window.setTimeout(() => wave.remove(), 600);
}
