/**
 * Turns a source clip into the background video the panel ships.
 *
 * The clip that started this was 3840x2160 AV1 -- a codec Safari cannot
 * decode on most Macs and iPhones, so those visitors would have seen a
 * black page -- and 37 MB, downloaded on every visit. This re-encodes to
 * 1080p H.264 + AAC, which every browser plays, at about a quarter of the
 * size, and writes a poster frame so nothing is blank while it buffers.
 *
 *   node scripts/encode-background.mjs "my video.mp4"
 *
 * Writes public/background.mp4 and public/background-poster.jpg. ffmpeg is
 * not a dependency of the app, so install it just for the run:
 *
 *   npm i --no-save ffmpeg-static
 *
 * Anything on PATH works too -- set FFMPEG to point at it.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_VIDEO = path.join(ROOT, "public", "background.mp4");
const OUT_POSTER = path.join(ROOT, "public", "background-poster.jpg");

/**
 * Quality knob, not a bitrate. 33 is deliberately lower than you would
 * pick for a video someone watches: this one sits behind a 45% black
 * scrim and a grid, under the whole UI, so detail that survives the
 * scrim is the only detail worth paying for.
 */
const CRF = 33;

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/encode-background.mjs "source.mp4"');
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const ffmpeg = resolveFfmpeg();
const mb = (file) => `${(fs.statSync(file).size / 1048576).toFixed(1)} MB`;

console.log(`source  ${source} (${mb(source)})`);

run([
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", source,
  // -2 keeps the height even, which H.264 requires, and preserves the
  // aspect ratio whatever the source happens to be.
  "-vf", "scale=1920:-2:flags=lanczos",
  "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
  "-preset", "slow", "-crf", String(CRF),
  // A cap for the loud moments; CRF alone would let a hard cut spike far
  // above what a phone on mobile data can keep up with.
  "-maxrate", "1100k", "-bufsize", "2200k",
  // yuv420p is the only pixel format every browser decodes.
  "-pix_fmt", "yuv420p",
  "-g", "60",
  // Puts the index at the front of the file, so playback can start on the
  // first few hundred kilobytes instead of waiting for the last byte.
  "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "96k", "-ac", "2",
  OUT_VIDEO,
]);

// Frame 0, so the poster is exactly what playback starts on and there is
// no flash when the video takes over.
run([
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", source,
  "-frames:v", "1",
  "-vf", "scale=1280:-2:flags=lanczos",
  "-q:v", "6",
  OUT_POSTER,
]);

console.log(`video   public/background.mp4 (${mb(OUT_VIDEO)})`);
console.log(`poster  public/background-poster.jpg (${mb(OUT_POSTER)})`);

function run(args) {
  const result = spawnSync(ffmpeg, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) {
    console.error("ffmpeg failed");
    process.exit(result.status ?? 1);
  }
}

function resolveFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;

  const bundled = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg.exe");
  if (fs.existsSync(bundled)) return bundled;

  const unix = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");
  if (fs.existsSync(unix)) return unix;

  return "ffmpeg";
}
