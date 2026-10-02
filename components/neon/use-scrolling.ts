import { useEffect, type RefObject } from "react";

/** The attribute set on a table while the page under it scrolls. */
export const SCROLLING_ATTR = "data-scrolling";

/** Rows wake up this long after the last scroll event. */
const SETTLE_MS = 150;

// One listener for every mounted table, not one per table: scroll
// events do not bubble, but a capturing listener on the document hears
// the window and every scroller in the page.
const tables = new Set<HTMLElement>();
const marked = new Set<HTMLElement>();
const LISTEN = { capture: true, passive: true } as const;
let last = 0;
let timer = 0;

function onScroll(event: Event) {
  const source = event.target;
  let hit = false;
  for (const table of tables) {
    // Only scrollers that carry the table: the page, the content column.
    // The sidebar, or the table's own sideways scroller, moves no row
    // under the pointer.
    if (source !== document && !(source instanceof Node && source !== table && source.contains(table))) continue;
    hit = true;
    if (!marked.has(table)) {
      table.setAttribute(SCROLLING_ATTR, "");
      marked.add(table);
    }
  }
  if (!hit) return;
  last = performance.now();
  if (!timer) timer = window.setTimeout(settle, SETTLE_MS);
}

// Re-armed rather than reset on every event, so a long scroll costs
// one timer per settle window instead of one per frame.
function settle() {
  const left = SETTLE_MS - (performance.now() - last);
  if (left > 1) {
    timer = window.setTimeout(settle, left);
    return;
  }
  timer = 0;
  for (const table of marked) table.removeAttribute(SCROLLING_ATTR);
  marked.clear();
}

/**
 * Marks `ref`'s element with `data-scrolling` while any scroller around
 * it moves, and for a moment after. Rows sliding under a still pointer
 * would otherwise flip their hover state every few frames and repaint
 * as they go; the table's CSS keys row hover off this attribute instead.
 * Plain DOM, no React state: nothing re-renders per scroll event.
 */
export function useScrolling(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!tables.size) document.addEventListener("scroll", onScroll, LISTEN);
    tables.add(el);
    return () => {
      tables.delete(el);
      marked.delete(el);
      el.removeAttribute(SCROLLING_ATTR);
      if (tables.size) return;
      document.removeEventListener("scroll", onScroll, LISTEN);
      window.clearTimeout(timer);
      timer = 0;
    };
  }, [ref]);
}
