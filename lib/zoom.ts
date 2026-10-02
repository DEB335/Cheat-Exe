/** The media query that switches the zoom (see "Page zoom" in globals.css). */
const ZOOMED = "(min-width: 1024px)";

let query: MediaQueryList | undefined;
/** query.matches when `cached` was read; undefined until the first read. */
let cachedFor: boolean | undefined;
let cached = 1;

/**
 * The page's CSS zoom: 0.75 on desktop, 1 on phones (see "Page zoom" in
 * globals.css).
 *
 * getBoundingClientRect, pointer clientX/Y and innerWidth/Height report
 * real screen pixels, while lengths written to a style are zoomed CSS
 * pixels. Divide the former by this before writing them as the latter.
 *
 * Read it at the moment of use: crossing the 1024px breakpoint changes it.
 * The computed style is read once per side of that breakpoint -- callers
 * run this from pointer and resize handlers, where getComputedStyle could
 * force a style recalc on every event. The media query is checked on each
 * call rather than through its change event, because that event fires
 * after `resize` and a resize handler would read the old side.
 */
export function pageZoom(): number {
  if (typeof document === "undefined") return 1;
  query ??= window.matchMedia(ZOOMED);
  const wide = query.matches;
  if (wide !== cachedFor) {
    cached = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    // A desktop read of 1 means the stylesheet has not landed yet; keep
    // reading until it has rather than remembering the unzoomed value.
    cachedFor = wide && cached === 1 ? undefined : wide;
  }
  return cached;
}
