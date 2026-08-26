/**
 * The CHEAT EXE brand mark, baked from the profile avatar below.
 *
 * Two choices here are specific to this logo. The source is a 125-frame
 * animated GIF, so a frame has to be picked -- frame 54 is the brightest
 * in the loop. And the raw 128px frame is mostly dark backdrop, so it is
 * cropped to the wordmark; uncropped it reads as an empty red square at
 * tab size. `public/favicon.ico` carries the same artwork at 16/32/48/64.
 *
 * The bytes are base64 in a module rather than a file read at runtime
 * because `readFile(process.cwd() + ...)` is not something Next's output
 * tracing can follow: the file would be missing from the deployed bundle
 * and the fallback would fail exactly when it is needed.
 */
export const ICON_SOURCE_AVATAR =
  "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif";

const ICON_FALLBACK_BASE64 =
  "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";

export const ICON_FALLBACK_PNG = Buffer.from(ICON_FALLBACK_BASE64, "base64");
