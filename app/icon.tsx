import sharp from "sharp";

import { ICON_FALLBACK_PNG, ICON_SOURCE_AVATAR } from "@/lib/assets/icon-fallback";
import { readDb } from "@/lib/db";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Reads the owner's avatar, so it cannot be prerendered at build time.
export const dynamic = "force-dynamic";

/** Long enough that the origin is not hit per tab, short enough to follow an edit. */
const CACHE = "public, max-age=300, stale-while-revalidate=86400";

/** Avatars live on an arbitrary CDN; do not hang a page load on one. */
const FETCH_TIMEOUT_MS = 3000;

/**
 * The browser-tab icon, taken from the avatar set on the Profile page.
 *
 * This is the only declared icon. The same artwork also sits at
 * `public/favicon.ico` for the /favicon.ico that browsers, bookmark
 * managers and crawlers ask for unprompted -- deliberately in `public/`
 * rather than `app/`, because `app/favicon.ico` would emit a second
 * <link rel="icon"> with an identical `sizes`, leaving the browser to
 * pick between the two.
 *
 * Doing it as a route rather than a static file is what lets changing the
 * avatar on the Profile page change the tab icon, with no redeploy.
 */
export default async function Icon() {
  const png = (await fromProfile()) ?? ICON_FALLBACK_PNG;

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType, "Cache-Control": CACHE },
  });
}

async function fromProfile(): Promise<Buffer | null> {
  try {
    const { profile } = await readDb();
    if (!profile.avatar) return null;

    // The usual case. The bundled mark is the same brand drawn for tab
    // size, so it reads better small than anything the generic path below
    // can pull out of this GIF -- and preferring it skips a CDN round trip
    // and a GIF decode as well.
    if (profile.avatar === ICON_SOURCE_AVATAR) return ICON_FALLBACK_PNG;

    const url = new URL(profile.avatar);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const source = Buffer.from(await response.arrayBuffer());
    // A different avatar gets generic treatment: first frame, squared,
    // sharpened to survive the downscale. `pages: 1` is what holds sharp
    // to frame one -- without it an animated GIF decodes as a single tall
    // strip with every frame stacked vertically.
    return await sharp(source, { animated: false, pages: 1 })
      .resize(size.width, size.height, { fit: "cover" })
      .sharpen()
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    // Unreachable database, dead CDN link, or something that is not an
    // image. The tab keeps the bundled mark rather than breaking.
    return null;
  }
}
