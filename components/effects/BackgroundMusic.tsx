"use client";

import { useEffect, useRef } from "react";

/**
 * The soundtrack, served straight from `public/`.
 *
 * It used to ride along as the audio track of the background video; the
 * video is gone, so this is that same track lifted out untouched -- the
 * AAC stream copied, not re-encoded, so it sounds exactly as it did.
 * `scripts/encode-music.mjs` rebuilds it from any source file, and puts
 * the index at the front so playback starts on the first few kilobytes
 * instead of waiting for the whole file.
 */
const SRC = "/background-music.m4a";

/**
 * Looping soundtrack behind the whole app. Nothing to see: an <audio>
 * without `controls` is never rendered, so this adds no layer to the page
 * and plays the same in light mode as in dark.
 */
export function BackgroundMusic() {
  const ref = useRef<HTMLAudioElement>(null);

  // Muted again here, before asking to play, rather than trusted to the
  // markup alone: nothing may be heard until someone asks for music. Chrome
  // will not start even a muted <audio> by itself -- its muted-autoplay
  // exemption covers video only -- so there this usually fails and the
  // track starts on the first unmute instead, which comes from a click and
  // is always allowed. Silent either way, so nothing is lost.
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.muted = true;
    void audio.play().catch(() => {
      /* no interaction yet; the first unmute starts it */
    });
  }, []);

  return (
    <audio
      ref={ref}
      src={SRC}
      preload="auto"
      loop
      muted
      autoPlay
      playsInline
      aria-hidden
      data-bg-music
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
  const audio = document.querySelector<HTMLAudioElement>("audio[data-bg-music]");
  if (!audio) return false;

  audio.muted = muted;
  if (muted) return true;

  try {
    await audio.play();
    return !audio.muted && !audio.paused;
  } catch {
    // Refused: there was no gesture behind it, and a browser that had the
    // track running muted pauses it for trying. Go back to silent rather
    // than leaving it stopped -- a muted soundtrack that keeps its place
    // is the lesser failure.
    audio.muted = true;
    void audio.play().catch(() => {});
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
