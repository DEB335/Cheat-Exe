"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  HoloGlyph,
  HoloPedestal,
  ParticleField,
  resolvePalette,
  usePauseWhenHidden,
  useSvgIds,
  type RGB,
} from "@/components/holo";
import { useDashboard } from "@/lib/store";
import { cn } from "@/lib/utils";

import styles from "./scene-profile.module.css";

// The mockup's two colourways: the avatar card burns warm (ember orange
// and gold into pink) against violet, the cloud is electric blue into
// violet.
const ORANGE: RGB = [255, 138, 61];
const GOLD: RGB = [255, 196, 90];
const PINK: RGB = [255, 79, 216];
const PURPLE: RGB = [168, 85, 247];
const VIOLET: RGB = [139, 92, 246];
const SKY: RGB = [96, 165, 250];
const BLUE: RGB = [59, 130, 246];
const CYAN: RGB = [34, 211, 238];
const INDIGO: RGB = [99, 102, 241];

const WARM_SPARKS: readonly RGB[] = [ORANGE, GOLD, PINK, PURPLE, VIOLET];
const CLOUD_SPARKS: readonly RGB[] = [SKY, BLUE, CYAN, INDIGO, VIOLET, PURPLE];
/** The cloud's platform: violet on the right fading to sky on the left, as the rim gradient runs c -> a. */
const CLOUD_PLATFORM: readonly RGB[] = [PURPLE, INDIGO, SKY];

/**
 * Streaks off the medallion: angle (0 = right, clockwise), how far out
 * along its path each one rests (0..1), and warm or cool. Staggered, so
 * the still set reads as a burst rather than a ring.
 */
const STREAKS: readonly { a: number; p: number; warm: boolean }[] = [
  { a: 196, p: 0.42, warm: true },
  { a: 168, p: 0.28, warm: true },
  { a: 218, p: 0.6, warm: true },
  { a: 244, p: 0.36, warm: false },
  { a: 318, p: 0.52, warm: false },
  { a: 340, p: 0.24, warm: false },
  { a: 12, p: 0.46, warm: false },
];

// Module classes are joined by hand, never through cn(): tailwind-merge
// only knows Tailwind's own names and is free to drop anything else.
const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/**
 * The profile card's hero: the avatar in a glowing ember-to-violet ring,
 * standing on a violet holographic pedestal, with light streaks flying
 * off it and warm and violet sparkles circling it -- the left card of
 * the profile mockup.
 *
 * The crown marks the owner account, as the mockup's "Account Owner"
 * pill does, so by default it follows the signed-in role; a reseller's
 * medallion has none.
 *
 * The caller sizes and places it (about 320 x 230); the scene is fitted
 * inside that box at its own ratio. Decorative: aria-hidden, no pointer
 * events. Of its own pieces only the medallion's slow sway moves
 * (paused off screen); the streaks, glows, crown and the ring's comet
 * are a still frame. One particle canvas.
 */
export function ProfileAvatarStage({
  src,
  className,
  crown,
}: {
  src: string;
  className?: string;
  /** Show the crown. Defaults to whether the signed-in user is the owner. */
  crown?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const medallionRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  return (
    <div ref={rootRef} aria-hidden className={`${styles.root} ${cn("relative", className)}`}>
      <div className={join(styles.frame, styles.avatarFrame)}>
        <div className={styles.avatarGlow} />
        <div className={styles.streaks}>
          {STREAKS.map((s) => (
            <span
              key={s.a}
              className={join(styles.streak, s.warm ? styles.warm : styles.cool)}
              style={{ "--a": `${s.a}deg`, "--p": s.p } as CSSProperties}
            />
          ))}
        </div>
        <HoloPedestal tone="violet" className={styles.avatarPedestal} />
        <ParticleField
          palette={WARM_SPARKS}
          density={1.3}
          radius={0.5}
          spread={1.3}
          anchorRef={medallionRef}
          edgeFade
          className={styles.avatarParticles}
        />
        <div ref={medallionRef} className={styles.medallion}>
          <div className={styles.idle}>
            <div className={styles.ringBloom} />
            <MedallionRing back />
            {/* Keyed on the address, so a new URL gets a fresh try
                rather than inheriting the last one's failure. */}
            <AvatarFace key={src} src={src} />
            <div className={styles.faceGlass} />
            <MedallionRing />
            <div className={styles.comet} />
            {(crown ?? isOwner) && <Crown />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The picture itself. The glass silhouette shows until the image has
 * decoded, and stays if it never does (the URL is free text), so neither
 * a slow CDN nor a dead link ever shows the browser's broken-image icon.
 */
function AvatarFace({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);
  const { id, url } = useSvgIds("pa");

  // decode() settles however the load went, even for an image that
  // finished before React was listening, and rejects for anything the
  // browser could not load or read. An onError prop could fire before
  // the component has mounted.
  useEffect(() => {
    let live = true;
    imgRef.current?.decode().then(
      () => live && setState("ready"),
      () => live && setState("failed"),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className={styles.face}>
      {state !== "ready" && (
        <svg viewBox="0 0 40 40">
          <HoloGlyph glyph="user" p={resolvePalette("violet")} id={id} url={url} x={7} y={6} size={26} />
        </svg>
      )}
      {src && state !== "failed" && (
        // Remote GIFs from an arbitrary CDN -- next/image would need a
        // configured loader for no benefit.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imgRef} src={src} alt="" draggable={false} data-ready={state === "ready" || undefined} />
      )}
    </div>
  );
}

/**
 * The medallion's rim: a crisp ember-gold-pink-violet ring over its own
 * bloom. The back copy is a dark, thick band set behind the face so the
 * disc shows an edge as it turns.
 */
function MedallionRing({ back = false }: { back?: boolean }) {
  const { id, url } = useSvgIds("pr");

  if (back) {
    return (
      <svg className={join(styles.layer, styles.ringBack)} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" fill="#12092e" className={styles.darkFill} />
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="#9a3412" strokeOpacity="0.85" strokeWidth="4" />
      </svg>
    );
  }

  return (
    <svg className={join(styles.layer, styles.ringFront)} viewBox="0 0 100 100">
      <defs>
        {/* Ember low on the left, gold across the top, pink and violet down the right. */}
        <linearGradient id={id("ring")} x1="0.1" y1="0.95" x2="0.9" y2="0.05">
          <stop offset="0" stopColor="#ff6a1a" />
          <stop offset="0.38" stopColor="#ffb347" />
          <stop offset="0.55" stopColor="#ffe3a3" />
          <stop offset="0.78" stopColor="#ff4fd8" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <filter id={id("bloom")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46.5" fill="none" stroke={url("ring")} strokeWidth="6" opacity="0.5" filter={url("bloom")} />
      <circle cx="50" cy="50" r="49.2" fill="none" stroke="#c084fc" strokeOpacity="0.45" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="46.5" fill="none" stroke={url("ring")} strokeWidth="3" />
      <circle cx="50" cy="50" r="44.4" fill="none" stroke="#fff4dc" strokeOpacity="0.55" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="47.6" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
    </svg>
  );
}

/** A gold crown with jewelled tips, floating over the ring. */
function Crown() {
  const { id, url } = useSvgIds("pc");
  const body =
    "M9 31 L5.2 12.2 Q5 10 7 11.2 L18.6 19.4 L28.3 5.8 Q30 3.6 31.7 5.8 L41.4 19.4 L53 11.2 Q55 10 54.8 12.2 L51 31 Z";

  return (
    <div className={styles.crown}>
      <div className={styles.crownFloat}>
        <svg className={styles.layer} viewBox="0 0 60 42">
          <defs>
            <linearGradient id={id("gold")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff7cc" />
              <stop offset="0.35" stopColor="#ffd36b" />
              <stop offset="0.72" stopColor="#f5a524" />
              <stop offset="1" stopColor="#c2560c" />
            </linearGradient>
            <linearGradient id={id("band")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe29a" />
              <stop offset="0.5" stopColor="#f59e0b" />
              <stop offset="1" stopColor="#9a3412" />
            </linearGradient>
            <radialGradient id={id("pearl")} cx="0.35" cy="0.3" r="0.7">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.4" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#ea580c" />
            </radialGradient>
            <filter id={id("bloom")} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          {/* Glow first, so the crown reads as lit metal rather than a flat icon. */}
          <path d={body} fill="#ffb020" opacity="0.33" filter={url("bloom")} />
          <path d={body} fill={url("gold")} />
          {/* The right half in shade, for volume. */}
          <path d="M30 4.6 L41.4 19.4 L53 11.2 Q55 10 54.8 12.2 L51 31 L30 31 Z" fill="#b45309" opacity="0.28" />
          <path d={body} fill="none" stroke="#fff3c4" strokeOpacity="0.9" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="8" y="29.6" width="44" height="7.6" rx="2.2" fill={url("band")} />
          <rect x="8" y="29.6" width="44" height="7.6" rx="2.2" fill="none" stroke="#fff3c4" strokeOpacity="0.7" strokeWidth="0.6" />
          <path d="M30 30.6 L32.8 33.4 L30 36.2 L27.2 33.4 Z" fill="#ff4f9a" stroke="#ffd1e6" strokeWidth="0.5" />
          <circle cx="18.5" cy="33.4" r="1.6" fill="#a855f7" stroke="#ead5ff" strokeWidth="0.4" />
          <circle cx="41.5" cy="33.4" r="1.6" fill="#a855f7" stroke="#ead5ff" strokeWidth="0.4" />
          <circle cx="5.6" cy="10.4" r="2.8" fill={url("pearl")} />
          <circle cx="30" cy="4" r="3.1" fill={url("pearl")} />
          <circle cx="54.4" cy="10.4" r="2.8" fill={url("pearl")} />
        </svg>
      </div>
    </div>
  );
}

// ---- Cloud scene ---------------------------------------------------

// The drawing is 440 x 140 units. The cloud is five circles' outer arcs
// on a flat base, drawn in a 140-wide box and placed by CLOUD_AT: scaled
// up so it is the header's centrepiece, as in the mockup (about 165 x 95,
// its crown 6 units under the frame's top), centred on x = 220 with its
// base on the platform's top face at y = 101.
const CLOUD =
  "M28 79 A18 18 0 0 1 28 43 A24 24 0 0 1 56.7 18.5 A28 28 0 0 1 106.9 26 A22 22 0 0 1 129.8 51.2 A15 15 0 0 1 122 79 Z";
const CLOUD_AT = "translate(124.45 -1.7) scale(1.3)";
/** Specular arcs across the tops of the three big lobes. */
const CLOUD_SHINE = ["M34.1 35.5 A19 19 0 0 1 45.5 24.1", "M58.4 26.1 A23 23 0 0 1 76 11.4", "M99.5 33.3 A17 17 0 0 1 113.8 32"];

/** A server box: [cx, top, half-width, rise, height, slots] (see IsoBox). */
type Box = readonly [number, number, number, number, number, number];

/**
 * Where the links run, and the racks along them. Beside the cloud, a
 * tall rack (about 2:1, four bays); further out, a squat box on the
 * line, as in the mockup.
 */
const LINK_Y = 74;
const RACKS: readonly Box[] = [
  [106, 36, 14, 4.2, 46, 4],
  [54, 63, 12, 3.4, 13, 2],
  [334, 36, 14, 4.2, 46, 4],
  [386, 63, 12, 3.4, 13, 2],
];
/** The server tower standing on the platform before the cloud. */
const TOWER: Box = [220, 37, 29, 8, 54, 5];

/** How far down each slot row sits from the lid's side corners. */
const slotRows = (h: number, slots: number) => Array.from({ length: slots }, (_, i) => (h * (i + 1)) / (slots + 1));

/** Status-light brightness, cycled through so a still row looks busy rather than flat. */
const LED_GLOW = [1, 0.35, 0.85, 0.5, 0.95, 0.3, 0.7];

/** A box's status lights, one by each slot on its left face; `start` offsets its run of LED_GLOW. */
const boxLeds = ([cx, ty, w, k, h, slots]: Box, start: number) =>
  slotRows(h, slots).map((s, i) => ({ x: cx - w * 0.2, y: ty + 1.8 * k + s, o: LED_GLOW[(start + i) % LED_GLOW.length] }));

const RACK_LEDS = RACKS.flatMap((box, i) => boxLeds(box, i * 3));
const TOWER_LEDS = boxLeds(TOWER, 2);
/** Packets on the links; `rest` is how far along its link each one sits. */
const PACKETS: readonly { x: number; inbound: boolean; rest: number }[] = [
  { x: 16, inbound: true, rest: 0.17 },
  { x: 16, inbound: true, rest: 0.5 },
  { x: 16, inbound: true, rest: 0.83 },
  { x: 424, inbound: false, rest: 0.17 },
  { x: 424, inbound: false, rest: 0.5 },
  { x: 424, inbound: false, rest: 0.83 },
];

/**
 * The Account Details header's decoration: a glassy blue-violet cloud
 * with a server tower before it, resting on a small holographic
 * platform, linked by dotted data lines to server racks either side,
 * with packets on the links and blue sparkles circling the cloud.
 *
 * The caller sizes and places it (about 440 x 140); the scene is fitted
 * inside that box at its own ratio. Decorative: aria-hidden, no pointer
 * events. A still frame apart from the platform and the particle
 * canvas, both paused off screen.
 */
export function CloudScene({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(rootRef);
  const { id, url } = useSvgIds("pk");

  return (
    <div ref={rootRef} aria-hidden className={`${styles.root} ${cn("relative", className)}`}>
      <div className={join(styles.frame, styles.cloudFrame)}>
        <div className={styles.cloudGlow} />

        {/* Behind the platform: the links, the packets on them, the racks.
            The packets and status lights are HTML over the SVG, layered
            in the drawing's order: links, packets, end points and racks,
            then the racks' status lights. */}
        <svg className={styles.layer} viewBox="0 0 440 140">
          <defs>
            <BoxGradients id={id} />
            <radialGradient id={id("packet")}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.35" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <filter id={id("soft")} x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="1" />
            </filter>
          </defs>

          {[
            [14, 150],
            [290, 426],
          ].map(([from, to]) => (
            <g key={from}>
              <path d={`M${from} ${LINK_Y} H${to}`} stroke="#60a5fa" strokeOpacity="0.12" strokeWidth="3" filter={url("soft")} />
              <path
                d={`M${from} ${LINK_Y} H${to}`}
                stroke="#93c5fd"
                strokeOpacity="0.75"
                strokeWidth="1.2"
                strokeDasharray="0.1 4"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>

        <div className={styles.layer}>
          {PACKETS.map((p) => (
            <span
              key={`${p.x}-${p.rest}`}
              className={join(styles.packet, p.inbound ? styles.packetIn : styles.packetOut)}
              style={{ ...at(p.x, LINK_Y), "--p": p.rest } as CSSProperties}
            >
              <svg viewBox="-3.2 -3.2 6.4 6.4">
                <circle r="3.2" fill={url("packet")} />
              </svg>
            </span>
          ))}
        </div>

        <svg className={styles.layer} viewBox="0 0 440 140">
          {/* End points: the far devices' uplinks. */}
          {[12, 428].map((x) => (
            <g key={x}>
              <circle cx={x} cy={LINK_Y} r="4" fill={url("packet")} />
              <circle cx={x} cy={LINK_Y} r="1.2" fill="#e0f2fe" />
            </g>
          ))}

          {RACKS.map((box) => (
            <IsoBox key={box[0]} box={box} url={url} />
          ))}
        </svg>
        <StatusLeds leds={RACK_LEDS} />

        <HoloPedestal tone={CLOUD_PLATFORM} beam={false} className={styles.cloudPedestal} />

        {/* On the platform: the cloud, and the server tower before it. */}
        <svg className={join(styles.layer, styles.cloudFront)} viewBox="0 0 440 140">
          <defs>
            <linearGradient id={id("cloud")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#60a5fa" stopOpacity="0.85" />
              <stop offset="0.5" stopColor="#6366f1" stopOpacity="0.72" />
              <stop offset="1" stopColor="#a855f7" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id={id("cloud-shine")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={id("cloud-core")} cx="0.5" cy="0.95" r="0.6">
              <stop offset="0" stopColor="#0b1040" stopOpacity="0.6" />
              <stop offset="1" stopColor="#0b1040" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id("cloud-rim")} x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="0.5" stopColor="#c4b5fd" />
              <stop offset="1" stopColor="#e879f9" />
            </linearGradient>
            <radialGradient id={id("base-light")}>
              <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="0.3" stopColor="#93c5fd" stopOpacity="0.3" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <filter id={id("bloom")} x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="1.8" />
            </filter>
          </defs>

          <g transform={CLOUD_AT}>
            {/* Stroke widths are in the cloud's own units, so they are
                set a notch under the look wanted, as the group scales. */}
            <path d={CLOUD} fill="none" stroke={url("cloud-rim")} strokeWidth="5.5" opacity="0.38" filter={url("bloom")} />
            <path d={CLOUD} fill={url("cloud")} />
            <path d={CLOUD} fill={url("cloud-core")} className={styles.darkFill} />
            <path d={CLOUD} fill={url("cloud-shine")} />
            {CLOUD_SHINE.map((d) => (
              <path key={d} d={d} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" />
            ))}
            <path d={CLOUD} fill="none" stroke={url("cloud-rim")} strokeWidth="1.3" strokeLinejoin="round" />
            <path d={CLOUD} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.4" strokeLinejoin="round" />
          </g>

          <ellipse cx="220" cy="105" rx="42" ry="8" fill={url("base-light")} />
          <IsoBox box={TOWER} url={url} />
        </svg>
        <StatusLeds leds={TOWER_LEDS} className={styles.cloudFront} />

        <div ref={anchorRef} className={styles.cloudAnchor} />
        <ParticleField
          palette={CLOUD_SPARKS}
          density={1.1}
          radius={0.95}
          spread={0.8}
          anchorRef={anchorRef}
          edgeFade
          className={styles.cloudParticles}
        />
      </div>
    </div>
  );
}

/** Glass for the server boxes, shared by the racks and the tower (SVG ids are page-wide). */
function BoxGradients({ id }: { id: (name: string) => string }) {
  return (
    <>
      <linearGradient id={id("box-top")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#bfdbfe" stopOpacity="0.8" />
        <stop offset="1" stopColor="#a78bfa" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id={id("box-left")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b82f6" stopOpacity="0.6" />
        <stop offset="1" stopColor="#1e3a8a" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id={id("box-right")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.6" />
        <stop offset="1" stopColor="#4c1d95" stopOpacity="0.5" />
      </linearGradient>
    </>
  );
}

/** Places an HTML piece at a point of the 440 x 140 drawing. */
const at = (x: number, y: number) => ({ left: `${x / 4.4}%`, top: `${y / 1.4}%` });

/**
 * The boxes' status lights, as HTML dots over the drawing. Still, each
 * at its own brightness: the stagger is the look.
 */
function StatusLeds({ leds, className }: { leds: readonly { x: number; y: number; o: number }[]; className?: string }) {
  return (
    <div className={join(styles.layer, className)}>
      {leds.map((l) => (
        <span key={`${l.x}-${l.y}`} className={styles.led} style={{ ...at(l.x, l.y), opacity: l.o }} />
      ))}
    </div>
  );
}

/**
 * A server box seen corner-on: a rhombus lid over a blue left face and a
 * violet right one, slots running across both faces along the lid's
 * slope, neon edges. Its status lights are drawn over it by StatusLeds.
 * (cx, ty) is the lid's back corner; w the half-width, k the lid's rise.
 */
function IsoBox({ box: [cx, ty, w, k, h, slots], url }: { box: Box; url: (name: string) => string }) {
  const top = `M${cx} ${ty} L${cx + w} ${ty + k} L${cx} ${ty + 2 * k} L${cx - w} ${ty + k} Z`;
  const left = `M${cx - w} ${ty + k} L${cx} ${ty + 2 * k} V${ty + 2 * k + h} L${cx - w} ${ty + k + h} Z`;
  const right = `M${cx} ${ty + 2 * k} L${cx + w} ${ty + k} V${ty + k + h} L${cx} ${ty + 2 * k + h} Z`;
  const outline = `M${cx} ${ty} L${cx + w} ${ty + k} V${ty + k + h} L${cx} ${ty + 2 * k + h} L${cx - w} ${ty + k + h} V${ty + k} Z`;
  const slope = k / w;
  const inset = w * 0.16;

  return (
    <g>
      <path d={outline} fill="none" stroke="#60a5fa" strokeOpacity="0.26" strokeWidth="3" filter={url("soft")} />
      <path d={outline} fill="#0b1040" fillOpacity="0.7" className={styles.darkFill} />
      <path d={left} fill={url("box-left")} />
      <path d={right} fill={url("box-right")} />
      <path d={top} fill={url("box-top")} />
      {slotRows(h, slots).map((s) => (
        <g key={s}>
          <path
            d={`M${cx - w + inset} ${ty + k + s + inset * slope} L${cx - w * 0.36} ${ty + k + s + w * 0.64 * slope}`}
            stroke="#93c5fd"
            strokeOpacity="0.9"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d={`M${cx + inset} ${ty + 2 * k + s - inset * slope} L${cx + w - inset} ${ty + k + s + inset * slope}`}
            stroke="#d8b4fe"
            strokeOpacity="0.7"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path d={outline} fill="none" stroke="#93c5fd" strokeOpacity="0.95" strokeWidth="0.9" strokeLinejoin="round" />
      <path d={`M${cx - w} ${ty + k} L${cx} ${ty + 2 * k} L${cx + w} ${ty + k} M${cx} ${ty + 2 * k} V${ty + 2 * k + h}`} fill="none" stroke="#e0e7ff" strokeOpacity="0.7" strokeWidth="0.7" />
    </g>
  );
}
