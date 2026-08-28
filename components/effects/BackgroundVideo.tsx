"use client";

import { useEffect, useRef } from "react";

/**
 * Served straight from `public/`, not embedded from YouTube.
 *
 * The source clip is 4K AV1, which Safari cannot decode on most Macs and
 * iPhones -- it would have shown a black page. `scripts/encode-background.mjs`
 * transcodes it to 1080p H.264 + AAC, which every browser plays, and moves
 * the moov atom to the front so playback starts on the first few hundred
 * kilobytes instead of waiting for the whole file.
 */
const SRC = "/background.mp4";

/** First frame, so the page is never blank while the video buffers. */
const POSTER = "/background-poster.jpg";

/**
 * Full-bleed looping video behind the whole app, with the dark scrim on
 * top. Both are hidden in light mode, matching the original rules.
 */
export function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  // React does not emit `muted` into server-rendered HTML -- it only sets
  // the property once hydrated -- so the browser sees an unmuted autoplay
  // video for a moment and refuses to start it. Setting it here, before
  // asking to play, is what makes autoplay actually happen.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {
      /* a tab restored in the background may refuse; the poster stands in */
    });
  }, []);

  return (
    <>
      <div className="fixed inset-0 -z-2 overflow-hidden bg-[#040718] lt:hidden">
        {/* `object-cover` is all the fitting this needs. The old YouTube
            embed had to be overscanned by a third to push its own title
            bar and "More videos" strip off screen; a plain file has no
            chrome to hide, so the whole frame is usable. */}
        <video
          ref={ref}
          className="pointer-events-none absolute inset-0 size-full object-cover"
          src={SRC}
          poster={POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          data-bg-video
        />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-1 bg-[rgba(4,7,24,0.45)] lt:hidden" />
    </>
  );
}

/** Faint 60px grid laid over the video (body::before in the original). */
export function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] [background-size:60px_60px]"
      style={{
        backgroundImage:
          "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
      }}
    />
  );
}

/**
 * Turns the soundtrack on or off.
 *
 * Answers whether the request was actually honoured, which is not the
 * same as what was asked for. Browsers refuse to let a page make noise
 * before anyone has interacted with it, and a site cannot opt out of
 * that; a refusal comes back as `false` so the caller can try again
 * later instead of believing it worked.
 */
export async function setBackgroundMusicMuted(muted: boolean): Promise<boolean> {
  const video = document.querySelector<HTMLVideoElement>("video[data-bg-video]");
  if (!video) return false;

  video.muted = muted;
  if (muted) return true;

  try {
    await video.play();
    return !video.muted && !video.paused;
  } catch {
    // Chrome pauses a video that unmutes itself with no gesture behind
    // it. Go back to silent rather than leaving a frozen frame -- a
    // muted background is the lesser failure.
    video.muted = true;
    void video.play().catch(() => {});
    return false;
  }
}

/**
 * Gets the soundtrack playing at the first moment the browser permits.
 *
 * It tries immediately, which is enough on its own for anyone whose
 * browser already trusts this site -- Chrome grants that to a site you
 * visit often and play sound on, so for a panel someone signs into every
 * day it starts working by itself after a few visits.
 *
 * Everywhere else it takes an interaction, so it keeps trying on every
 * one until a try actually lands. Retrying is the point: the first event
 * a page sees is nearly always `mousemove`, which does not count as an
 * interaction, and the previous version spent its single attempt there
 * and unhooked itself before the click that followed could be heard.
 *
 * Used on the login page only: the dashboard deliberately stays silent
 * until you ask for music.
 */
export function useAutoUnmute(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const attempt = () => {
      if (cancelled) return;
      void setBackgroundMusicMuted(false).then((allowed) => {
        if (allowed && !cancelled) stop();
      });
    };

    const stop = () => {
      for (const type of EVENTS) document.removeEventListener(type, attempt);
    };

    attempt();
    for (const type of EVENTS) document.addEventListener(type, attempt, { passive: true });

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled]);
}

// Everything here is worth retrying on, but only some of it can ever
// succeed: browsers count a click, a key or a tap as an interaction and
// pointedly do not count moving the mouse.
const EVENTS = ["pointerdown", "pointerup", "click", "keydown", "touchend", "mousemove"] as const;
