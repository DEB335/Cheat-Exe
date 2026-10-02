import styles from "./lamp-room.module.css";

/* ==================================================================
   The room around the floor lamp on the login page -- everything that
   does NOT move with the lamp: wall, glossy floor, the warm line where
   they meet, the plant on its pedestal (far left), the glass half-disc
   behind the card, the blue-lit window at the right edge and the
   blue bloom the card throws on the floor.

   OFF the room is pitch black with a barely-there floor. ON, two
   pre-painted layers fade in on the stage's timeline: the warm
   ambient (wall wash, horizon line, plant, arc) and, a beat later, the
   cool window light. Opacity only, so the crossfade never repaints.

   All geometry is in design px of the 1478 x 1064 mock-up, scaled by
   the stage's --u and placed from its --cx0 / --horizon (the module
   has fallbacks, so the room also renders without the stage). The
   wall and floor are full-bleed; the window runs to the right edge.
   ================================================================== */

/** Rounds to one decimal so the generated paths stay short. */
const r = (n: number) => Math.round(n * 10) / 10;

/**
 * A pointed oval leaf from its stalk end (bx, by) to its tip (tx, ty), roughly 2w wide.
 * `bend` curls the blade sideways (in units of w; positive bends towards +normal).
 */
function leafPath(bx: number, by: number, tx: number, ty: number, w: number, bend = 0) {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const p = (f: number, s: number) => {
    const k = s + bend * Math.sin(f * Math.PI);
    return `${r(bx + dx * f + nx * k)} ${r(by + dy * f + ny * k)}`;
  };
  return `M${bx} ${by}C${p(0.05, 1.3)} ${p(0.6, 1.1)} ${tx} ${ty}C${p(0.6, -1.1)} ${p(0.05, -1.3)} ${bx} ${by}Z`;
}

type Leaf = { b: [number, number]; t: [number, number]; w: number; tone: "lit" | "bright" | "shade" };

/* The plant, in design px. The lamp stands to its right, so leaves
   reaching right catch warm light; the ones reaching left (only seen
   on screens wider than the mock-up) stay in shadow. Back to front. */
const LEAVES: Leaf[] = [
  { b: [-4, 434], t: [-20, 386], w: 14, tone: "shade" },
  { b: [-8, 448], t: [-54, 404], w: 17, tone: "shade" },
  { b: [-10, 474], t: [-76, 462], w: 17, tone: "shade" },
  { b: [-12, 504], t: [-66, 532], w: 16, tone: "shade" },
  { b: [-4, 490], t: [22, 456], w: 13, tone: "shade" },
  { b: [-2, 520], t: [-30, 548], w: 12, tone: "shade" },
  { b: [0, 446], t: [37, 396], w: 16, tone: "lit" },
  { b: [16, 436], t: [58, 420], w: 9, tone: "lit" },
  { b: [6, 476], t: [30, 468], w: 9, tone: "lit" },
  { b: [24, 464], t: [88, 452], w: 18, tone: "lit" },
  { b: [10, 508], t: [28, 486], w: 9, tone: "lit" },
  { b: [4, 530], t: [30, 556], w: 10, tone: "lit" },
  { b: [8, 518], t: [48, 540], w: 12, tone: "lit" },
  { b: [30, 486], t: [88, 528], w: 19, tone: "bright" },
];

/* Leaves arch: right-reaching ones bow up and droop at the tip, the
   shaded left-reaching ones mirror that. */
const LEAF_PATHS = LEAVES.map(({ b: [bx, by], t: [tx, ty], w, tone }) => {
  const bend = tone === "shade" ? 0.45 : -0.45;
  const len = Math.hypot(tx - bx, ty - by);
  const cx = (bx + tx) / 2 + (-(ty - by) / len) * w * bend * 2;
  const cy = (by + ty) / 2 + ((tx - bx) / len) * w * bend * 2;
  return {
    d: leafPath(bx, by, tx, ty, w, bend),
    rib: `M${bx} ${by}Q${r(cx)} ${r(cy)} ${r(bx + (tx - bx) * 0.94)} ${r(by + (ty - by) * 0.94)}`,
    /* The stalk runs from the soil up to the leaf's base. */
    stem: `M${r(bx * 0.25)} 566Q${r(bx * 0.15)} ${r((566 + by) / 2)} ${bx} ${by}`,
    tone,
  };
});

/** The plant on its round pedestal. The pedestal's centre sits on the canvas's left edge (x 0). */
function PlantPedestal() {
  return (
    <svg className={styles.plantSvg} viewBox="-160 380 330 430" preserveAspectRatio="none">
      <defs>
        {/* Dark olive leaves (design avg #2d3310), brightest where the
            lamp catches their right-hand edges. */}
        <linearGradient id="lr-leaf-lit" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#090a06" />
          <stop offset="0.45" stopColor="#1d220f" />
          <stop offset="0.82" stopColor="#2f3514" />
          <stop offset="1" stopColor="#555a2a" />
        </linearGradient>
        <linearGradient id="lr-leaf-bright" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#0b0c07" />
          <stop offset="0.4" stopColor="#262b11" />
          <stop offset="0.78" stopColor="#40461c" />
          <stop offset="1" stopColor="#6e6c34" />
        </linearGradient>
        <linearGradient id="lr-leaf-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#050604" />
          <stop offset="1" stopColor="#13160b" />
        </linearGradient>
        <linearGradient id="lr-leaf-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.45" stopColor="#d9a35a" stopOpacity="0" />
          <stop offset="1" stopColor="#e8b066" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="lr-pot" x1="-52" y1="0" x2="52" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#141210" />
          <stop offset="0.5" stopColor="#3a3431" />
          <stop offset="0.6" stopColor="#5e5249" />
          <stop offset="0.73" stopColor="#97806c" />
          <stop offset="0.85" stopColor="#b08a66" />
          <stop offset="0.95" stopColor="#dca45e" />
          <stop offset="1" stopColor="#6d4a28" />
        </linearGradient>
        <linearGradient id="lr-pot-rim" x1="-52" y1="0" x2="52" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a2e22" />
          <stop offset="0.6" stopColor="#cda758" />
          <stop offset="1" stopColor="#eead59" />
        </linearGradient>
        <linearGradient id="lr-pot-shade" x1="0" y1="569" x2="0" y2="655" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="lr-ped-side" x1="-142" y1="0" x2="142" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#080808" />
          <stop offset="0.55" stopColor="#141314" />
          <stop offset="0.7" stopColor="#2a2626" />
          <stop offset="0.85" stopColor="#2a221d" />
          <stop offset="0.95" stopColor="#38261a" />
          <stop offset="1" stopColor="#8a6a4a" />
        </linearGradient>
        <linearGradient id="lr-ped-side-v" x1="0" y1="654" x2="0" y2="778" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0.12" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#b8702a" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="lr-ped-top" x1="-142" y1="0" x2="142" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0e0d0d" />
          <stop offset="0.45" stopColor="#1e1713" />
          <stop offset="0.66" stopColor="#5b3a19" />
          <stop offset="0.85" stopColor="#6a441c" />
          <stop offset="1" stopColor="#3a2713" />
        </linearGradient>
        <linearGradient id="lr-ped-rim" x1="-142" y1="0" x2="142" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e2a050" stopOpacity="0" />
          <stop offset="0.45" stopColor="#e2a050" stopOpacity="0.45" />
          <stop offset="0.8" stopColor="#f2b562" stopOpacity="0.95" />
          <stop offset="1" stopColor="#c07a32" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="lr-ped-led" x1="-142" y1="0" x2="142" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffad9" stopOpacity="0.6" />
          <stop offset="0.4" stopColor="#fffad9" />
          <stop offset="0.86" stopColor="#fff2c4" />
          <stop offset="1" stopColor="#f0b860" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="lr-ped-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f0a040" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#c07028" stopOpacity="0.3" />
          <stop offset="1" stopColor="#c07028" stopOpacity="0" />
        </radialGradient>
        <filter id="lr-soft" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="lr-spill" x="-20%" y="-300%" width="140%" height="700%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Warm pool the pedestal's LED strip throws on the floor, and the
          ~20 px spill hugging the strip. */}
      <ellipse cx="30" cy="786" rx="190" ry="24" fill="url(#lr-ped-pool)" />
      <path
        d="M-142 756A142 28 0 0 0 142 756"
        fill="none"
        stroke="#e79e41"
        strokeWidth="16"
        strokeOpacity="0.75"
        filter="url(#lr-spill)"
      />

      {/* Pedestal: the front of the cylinder, its top, the lit rims. */}
      <path
        d="M-142 653.5L-142 748A142 28 0 0 0 142 748L142 653.5A142 13.5 0 0 1 -142 653.5Z"
        fill="url(#lr-ped-side)"
      />
      <path
        d="M-142 653.5L-142 748A142 28 0 0 0 142 748L142 653.5A142 13.5 0 0 1 -142 653.5Z"
        fill="url(#lr-ped-side-v)"
      />
      <ellipse cx="0" cy="653.5" rx="142" ry="13.5" fill="url(#lr-ped-top)" />
      <path d="M-142 653.5A142 13.5 0 0 0 142 653.5" fill="none" stroke="url(#lr-ped-rim)" strokeWidth="1.6" />
      {/* The LED strip: a hot 2.5 px core in a tight amber glow. */}
      <path
        d="M-142 748A142 28 0 0 0 142 748"
        fill="none"
        stroke="#fed161"
        strokeWidth="6"
        strokeOpacity="0.95"
        filter="url(#lr-soft)"
      />
      <path d="M-142 748A142 28 0 0 0 142 748" fill="none" stroke="url(#lr-ped-led)" strokeWidth="2.6" />

      {/* Stalks, then leaves back to front. */}
      <g fill="none" stroke="#24331a" strokeWidth="1.6" strokeLinecap="round">
        {LEAF_PATHS.map((l, i) => (
          <path key={i} d={l.stem} />
        ))}
      </g>
      {LEAF_PATHS.map((l, i) => (
        <g key={i}>
          <path d={l.d} fill={`url(#lr-leaf-${l.tone})`} />
          {l.tone !== "shade" && (
            <>
              <path d={l.d} fill="none" stroke="url(#lr-leaf-rim)" strokeWidth="0.9" />
              <path d={l.rib} fill="none" stroke="#b8a868" strokeOpacity="0.26" strokeWidth="0.8" />
            </>
          )}
        </g>
      ))}

      {/* Pot: soil, body, lip. Cream ceramic lit warm from the right. */}
      <path
        d="M-52 569L52 569C52 606 51 629 46 641Q42 654 30 655L-30 655Q-42 654 -46 641C-51 629 -52 606 -52 569Z"
        fill="url(#lr-pot)"
      />
      <path
        d="M-52 569L52 569C52 606 51 629 46 641Q42 654 30 655L-30 655Q-42 654 -46 641C-51 629 -52 606 -52 569Z"
        fill="url(#lr-pot-shade)"
      />
      <ellipse cx="0" cy="569.5" rx="52" ry="4" fill="url(#lr-pot-rim)" />
      <ellipse cx="0" cy="568.6" rx="48.5" ry="2.8" fill="#160e07" />
    </svg>
  );
}

/* The glass disc: centre (881, 762), radius 185, sunk below the floor
   line, so it rises from x 697 at the horizon to its top (881, 577)
   behind the card's left edge. */
const ARC_EDGE = "M697.2 741A185 185 0 0 1 1064.8 741";

/** The clear glass disc standing behind the card's lower-left. */
function GlassArc() {
  return (
    <svg className={styles.arcSvg} viewBox="680 560 400 200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lr-arc-edge" x1="697" y1="741" x2="881" y2="577" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#cd863b" />
          <stop offset="0.3" stopColor="#9a6228" stopOpacity="0.8" />
          <stop offset="0.65" stopColor="#5a4030" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3a2c26" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="lr-arc-fill" x1="0" y1="577" x2="0" y2="741" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a0c12" stopOpacity="0.2" />
          <stop offset="1" stopColor="#0a0c12" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="lr-arc-sheen" cx="760" cy="650" r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffc890" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffc890" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lr-arc-base" x1="697" y1="0" x2="1064" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e09a45" />
          <stop offset="0.07" stopColor="#c48136" />
          <stop offset="0.47" stopColor="#5d3b1c" />
          <stop offset="1" stopColor="#5d3b1c" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d={`${ARC_EDGE}Z`} fill="url(#lr-arc-fill)" />
      <path d={`${ARC_EDGE}Z`} fill="url(#lr-arc-sheen)" />
      {/* The glass's one crisp edge, amber where the lamp catches it. */}
      <path d={ARC_EDGE} fill="none" stroke="url(#lr-arc-edge)" strokeWidth="1.4" />
      <path d="M697 740.4L1064 740.4" stroke="url(#lr-arc-base)" strokeWidth="1.4" />
    </svg>
  );
}

/** The window's ledge, from canvas x 1345 (under the card) to the right edge; stretched to fit. */
function Sill() {
  return (
    <svg viewBox="0 0 133 46" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lr-sill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#18233e" />
          <stop offset="1" stopColor="#24334f" />
        </linearGradient>
      </defs>
      <polygon points="0,0 133,0 133,40 0,6" fill="url(#lr-sill)" />
      <polygon points="0,6 133,40 133,46 0,10" fill="#0a0c16" />
      <line x1="0" y1="0.6" x2="133" y2="0.6" stroke="#4f71b0" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="6" x2="133" y2="40" stroke="#5371a5" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LampRoom({ on }: { on: boolean }) {
  return (
    <div aria-hidden className={styles.room} data-on={on}>
      {/* Always there: the floor's texture, all you see with the light off. */}
      <div className={styles.floorDark} />

      {/* Warm ambient: the lamp lights the room. */}
      <div className={`${styles.layer} ${styles.warm}`}>
        <div className={styles.wall} />
        {/* Fine grain on the lit wall, so its gradients never band. */}
        <div className={styles.grain} />
        <div className={styles.floor} />
        <div className={styles.wallGlow} />
        <div className={styles.line} />
        <div className={styles.lineSheen} />
        <div className={styles.arc}>
          <GlassArc />
        </div>
      </div>

      {/* Cool light: the window and the card's blue cast. */}
      <div className={`${styles.layer} ${styles.cool}`}>
        <div className={styles.wallCool} />
        <div className={styles.floorCool} />
        <div className={styles.bloom} />
        <div className={styles.window}>
          <div className={styles.paneFar} />
          <div className={styles.paneNear} />
          <div className={styles.mullion} />
          <div className={styles.frameLine} />
          <div className={styles.recess} />
          <div className={styles.sill}>
            <Sill />
          </div>
        </div>
        <div className={styles.windowSpill} />
      </div>

      {/* The plant and pedestal stand in front of the wall the lamp's cone
          lights, so they get their own warm layer above the lamp. */}
      <div className={`${styles.layer} ${styles.warm} ${styles.front}`}>
        <div className={styles.plant}>
          <PlantPedestal />
        </div>
      </div>
    </div>
  );
}
