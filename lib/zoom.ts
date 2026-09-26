/**
 * The page's CSS zoom: 0.75 on desktop, 1 on phones (see "Page zoom" in
 * globals.css).
 *
 * getBoundingClientRect, pointer clientX/Y and innerWidth/Height report
 * real screen pixels, while lengths written to a style are zoomed CSS
 * pixels. Divide the former by this before writing them as the latter.
 *
 * Read it at the moment of use: crossing the 1024px breakpoint changes it.
 */
export function pageZoom(): number {
  if (typeof document === "undefined") return 1;
  return parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
}
