"use client";

import { useEffect } from "react";

const VIDEO_ID = "-Neidi-McvA";

const SRC =
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
  `?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}` +
  "&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&vq=hd2160&enablejsapi=1";

/**
 * Full-bleed looping video behind the whole app, with the dark scrim on
 * top. Both are hidden in light mode, matching the original rules.
 */
export function BackgroundVideo() {
  return (
    <>
      <div className="fixed inset-0 -z-2 overflow-hidden bg-[#040718] lt:hidden">
        <iframe
          className="pointer-events-none absolute top-1/2 left-1/2 h-[56.25vw] max-h-none w-full min-h-full min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2"
          src={SRC}
          title="Background"
          referrerPolicy="strict-origin-when-cross-origin"
          frameBorder="0"
          allow="autoplay; encrypted-media"
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

/** Mutes/unmutes the background video through the YouTube iframe API. */
export function setBackgroundMusicMuted(muted: boolean) {
  const iframe = document.querySelector<HTMLIFrameElement>("[data-bg-video]");
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func: muted ? "mute" : "unMute", args: "" }),
    "*",
  );
}

/**
 * Starts the soundtrack as soon as the visitor interacts with the page.
 *
 * The embed has to autoplay muted -- browsers block audible autoplay --
 * so the first click, keypress or mouse move is used as the gesture that
 * lets it unmute. Used on the login page only: the dashboard
 * deliberately stays silent until you ask for music.
 */
export function useAutoUnmute(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let done = false;
    const unmute = () => {
      if (done) return;
      done = true;
      setBackgroundMusicMuted(false);
      for (const type of EVENTS) document.removeEventListener(type, unmute);
    };

    for (const type of EVENTS) document.addEventListener(type, unmute, { passive: true });
    // Some browsers allow it outright; try once without waiting for input.
    const timer = window.setTimeout(() => setBackgroundMusicMuted(false), 1000);

    return () => {
      window.clearTimeout(timer);
      for (const type of EVENTS) document.removeEventListener(type, unmute);
    };
  }, [enabled]);
}

const EVENTS = ["click", "keydown", "mousemove"] as const;
