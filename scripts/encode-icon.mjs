/**
 * Bakes a source logo into the two icons the panel ships.
 *
 * A browser tab gets 16 or 32 real pixels, so the artwork cannot just be
 * pointed at: it has to be trimmed to the mark, downscaled with a good
 * kernel, sharpened, and cut to a circle, or the wordmark smears and the
 * round badge lands in the tab as a square. This does that once, at
 * build-your-own-asset time, rather than per request.
 *
 *   node scripts/encode-icon.mjs "logo.png"
 *
 * Writes public/favicon.ico (16/32/48/64 in one file, for the
 * /favicon.ico browsers ask for unprompted) and rewrites the base64 in
 * lib/assets/icon-fallback.ts (the 64px mark app/icon.tsx serves). Both
 * come out of the same pipeline so the tab never disagrees with itself.
 *
 * sharp is already a dependency, so unlike the video encoder this needs
 * nothing installed. Keep the source file somewhere safe -- it is not
 * committed, for the same reason the video source is not.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ICO = path.join(ROOT, "public", "favicon.ico");
const OUT_TS = path.join(ROOT, "lib", "assets", "icon-fallback.ts");

/**
 * 16 and 32 are what tabs and bookmark bars actually draw; 48 is what
 * Windows shortcuts pick up, and 64 matches the `size` app/icon.tsx
 * declares, so a browser that prefers the .ico still gets the same
 * pixels it would have got from the route.
 */
const SIZES = [16, 32, 48, 64];

/**
 * How far from pure black still counts as border. The badge is a black
 * disc on a black square, so the only thing separating the two is the
 * thin bright ring around the rim: the threshold sits above the disc's
 * own near-black fill and below that ring, which is what makes the trim
 * stop at the rim rather than eating its way in to the wordmark.
 */
const TRIM_THRESHOLD = 20;

/**
 * The circular mask is drawn this many times over and scaled back down.
 * An SVG circle rasterised straight to 16px has a visibly stepped rim;
 * the same circle drawn at 128 and reduced lands as a smooth edge.
 */
const MASK_SUPERSAMPLE = 8;

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/encode-icon.mjs "logo.png"');
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const mark = await square(source);

const icons = [];
for (const size of SIZES) {
  // `sharpen` is what buys back the edge the downscale costs -- without
  // it the wordmark reads as a gradient rather than as letters at 32.
  const flat = await sharp(mark).resize(size, size, { fit: "cover" }).sharpen().png().toBuffer();

  icons.push({
    size,
    // Cut the disc last, at the finished size. Masking the source
    // instead would leave `sharpen` to run along the rim, which rings
    // the transparent edge with a bright halo; and a mask drawn once at
    // full size then reduced four ways is four different soft edges,
    // where this is one crisp circle per icon.
    data: await sharp(flat)
      .composite([{ input: await disc(size), blend: "dest-in" }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  });
}

fs.writeFileSync(OUT_ICO, ico(icons));
writeFallback(icons.find((icon) => icon.size === 64).data);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(`source   ${source} (${kb(fs.statSync(source).size)})`);
for (const { size, data } of icons) console.log(`  ${size}x${size}   ${kb(data.length)}`);
console.log(`icon     public/favicon.ico (${kb(fs.statSync(OUT_ICO).size)})`);
console.log(`fallback lib/assets/icon-fallback.ts`);

/**
 * Trims the flat border off the source and squares up what is left.
 *
 * Squaring first matters: `resize(64, 64, { fit: "cover" })` on an
 * oblong crops to the centre of the long axis, which on a round badge
 * shaves the top and bottom off the ring. Padding back out to a square
 * is what keeps the badge centred, so that the disc cut later sits on
 * the rim instead of a few pixels off it.
 */
async function square(file) {
  const trimmed = await sharp(file)
    .trim({ background: "#000000", threshold: TRIM_THRESHOLD })
    .png()
    .toBuffer();

  const { width, height } = await sharp(trimmed).metadata();
  const side = Math.max(width, height);

  return await sharp(trimmed)
    .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * A white disc filling `size`, to composite as an alpha mask.
 *
 * `dest-in` keeps the icon only where this is opaque, so the corners of
 * the square drop out and the badge arrives in the tab as the round
 * thing it was drawn as, whatever colour the browser paints behind it.
 */
async function disc(size) {
  const drawn = size * MASK_SUPERSAMPLE;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawn}" height="${drawn}">` +
      `<circle cx="${drawn / 2}" cy="${drawn / 2}" r="${drawn / 2}" fill="#fff"/>` +
      `</svg>`,
  );

  return await sharp(svg).resize(size, size).png().toBuffer();
}

/**
 * Packs the PNGs into an .ico.
 *
 * The container is a header, one 16-byte directory entry per image, then
 * the images back to back. Entries hold PNG rather than the BMP the
 * format was written for, which every browser since IE11 reads and which
 * keeps the file a third of the size.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // 1 = icon, as opposed to 2 = cursor
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, data }, index) => {
    const entry = index * 16;
    // A byte per side, and 0 means 256 -- which is why nothing here goes
    // above 64 without special-casing.
    directory[entry] = size;
    directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ data }) => data)]);
}

/** Swaps the baked bytes into the module app/icon.tsx falls back to. */
function writeFallback(png) {
  const current = fs.readFileSync(OUT_TS, "utf8");
  // Match whatever the file already uses, so a rebake shows up as one
  // changed constant and not as every line in the file.
  const eol = current.includes("\r\n") ? "\r\n" : "\n";

  const literal = png
    .toString("base64")
    .match(/.{1,100}/g)
    .map((chunk) => `  "${chunk}"`)
    .join(` +${eol}`);

  const next = current.replace(
    /^(const ICON_FALLBACK_BASE64 =\r?\n)[\s\S]*?";\r?\n/m,
    `$1${literal};${eol}`,
  );
  if (next === current) {
    console.error(`Could not find ICON_FALLBACK_BASE64 in ${OUT_TS}`);
    process.exit(1);
  }

  fs.writeFileSync(OUT_TS, next);
}
