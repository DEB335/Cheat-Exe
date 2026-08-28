/**
 * The CHEAT EXE brand mark, baked for tab size by scripts/encode-icon.mjs.
 *
 * The source is the round badge logo, 1254px of almost nothing but
 * artwork, so it needs only its thin black margin trimmed before the
 * downscale -- where the animated logo it replaced was mostly backdrop
 * and had to be cropped to the wordmark to read as anything at all.
 * What is left is then cut to a disc, so the badge arrives in the tab
 * round rather than as a black square with a circle drawn inside it.
 * `public/favicon.ico` carries the same artwork at 16/32/48/64.
 *
 * The bytes are base64 in a module rather than a file read at runtime
 * because `readFile(process.cwd() + ...)` is not something Next's output
 * tracing can follow: the file would be missing from the deployed bundle
 * and the fallback would fail exactly when it is needed.
 */

/**
 * The animated logo the owner's profile avatar points at: the same brand
 * as the mark above, drawn to be watched rather than to survive a 16px
 * downscale. app/icon.tsx serves the mark instead of a frame of this.
 */
export const ICON_SOURCE_AVATAR =
  "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif";

const ICON_FALLBACK_BASE64 =
  "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";

export const ICON_FALLBACK_PNG = Buffer.from(ICON_FALLBACK_BASE64, "base64");
