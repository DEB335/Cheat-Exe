/**
 * Turns a source file into the background soundtrack the panel ships.
 *
 * The music used to play as the audio track of a full-screen background
 * video -- 10 MB downloaded on every visit for what was, by the end, only
 * ever heard. This keeps the sound and nothing else: the first audio track
 * of whatever you hand it, video or audio, written out as a plain AAC
 * file of about a tenth of the size.
 *
 *   node scripts/encode-music.mjs "my video.mp4"
 *
 * Writes public/background-music.m4a. ffmpeg is not a dependency of the
 * app, so install it just for the run:
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
const OUT_MUSIC = path.join(ROOT, "public", "background-music.m4a");

/**
 * Only used when the source is not AAC already. An AAC source is copied
 * bit for bit instead -- re-encoding a lossy track only ever loses more,
 * and every browser plays AAC as it is.
 */
const BITRATE = "160k";

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/encode-music.mjs "source.mp4"');
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const ffmpeg = resolveFfmpeg();
const mb = (file) => `${(fs.statSync(file).size / 1048576).toFixed(1)} MB`;

console.log(`source  ${source} (${mb(source)})`);

const codec = audioCodec(source);
if (!codec) {
  console.error("The source has no audio track.");
  process.exit(1);
}

run([
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", source,
  // The first audio track only: no video, and no cover art either, which
  // an mp3 or m4a source would otherwise carry along as a second stream.
  "-map", "0:a:0", "-vn",
  ...(codec === "aac"
    ? ["-c:a", "copy"]
    : ["-c:a", "aac", "-b:a", BITRATE, "-ac", "2"]),
  // Puts the index at the front of the file, so playback can start on the
  // first few kilobytes instead of waiting for the last byte.
  "-movflags", "+faststart",
  OUT_MUSIC,
]);

console.log(`music   public/background-music.m4a (${mb(OUT_MUSIC)}, ${codec === "aac" ? "copied" : `${codec} -> aac ${BITRATE}`})`);

function run(args) {
  const result = spawnSync(ffmpeg, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) {
    console.error("ffmpeg failed");
    process.exit(result.status ?? 1);
  }
}

/**
 * The codec of the source's first audio track, or null if it has none.
 *
 * ffmpeg-static ships no ffprobe, so this reads the stream list ffmpeg
 * prints for an input given no output -- it exits with an error saying
 * so, which is expected and ignored.
 */
function audioCodec(file) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const match = /Stream #\d+:\d+.*?: Audio: (\w+)/.exec(result.stderr ?? "");
  return match ? match[1] : null;
}

function resolveFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;

  const bundled = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg.exe");
  if (fs.existsSync(bundled)) return bundled;

  const unix = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");
  if (fs.existsSync(unix)) return unix;

  return "ffmpeg";
}
