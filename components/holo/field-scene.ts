import { lighten, mix, type RGB } from "./palettes";
import { spriteCanvas, type Context2D, type ParticleScene, type SceneMode, type SceneSize, type Surface } from "./particle-scene";

/*
 * The drawing behind ParticleField: a 3D particle volume, for the
 * holograms' sparkle. Tiny sharp specks, glowing dots, four-point star
 * glints that flash, and a few big out-of-focus bokeh discs, all placed
 * in a small 3D world, turned, and projected, so near particles are
 * bigger, brighter and cross faster than far ones, and anything off the
 * focal plane spreads into a softer disc.
 *
 * Positions are a pure function of a shared clock, so two fields with
 * the same config -- a stage's back and front layers -- stay in lockstep
 * without talking to each other; every glow is a sprite rendered once
 * and stamped with drawImage from one atlas; and nothing uses
 * Math.random, so the layout is the same on every mount.
 *
 * No DOM and no React: this runs in the particle worker, or on the main
 * thread where OffscreenCanvas is missing.
 */

export type FieldShape = "orbit" | "column" | "dome";
export type FieldLayer = "all" | "back" | "front";

/** Everything a field needs to draw itself; plain data, so it can be posted to the worker. */
export interface FieldConfig {
  /** The particle colours, then the palette's white-hot last. */
  colors: RGB[];
  shape: FieldShape;
  density: number;
  seed: number;
  spread: number;
  /** Field radius as a fraction of the box's shorter side. */
  radius: number;
  speed: number;
  layer: FieldLayer;
  /** The shared clock's zero, in absolute ms (timeOrigin + performance.now()). */
  epoch: number;
}

const SPECK = 0;
const DOT = 1;
const STAR = 2;
const BOKEH = 3;
type Kind = typeof SPECK | typeof DOT | typeof STAR | typeof BOKEH;

interface Particle {
  kind: Kind;
  /** Screen-filling dust rather than part of the shape. */
  ambient: boolean;
  /** Orbit/shell/column radius in world units. */
  r: number;
  /** Starting angle about the vertical axis. */
  a: number;
  /** Orbit: height off the orbit plane. Dome: height on the unit sphere. */
  h: number;
  /** Orbit: extra inclination of this particle's orbit plane, as its cosine and sine. */
  ci: number;
  si: number;
  /** Angular speed factor (inner orbits run faster). */
  spin: number;
  /** Column/ambient: starting height fraction and rise per second. */
  v: number;
  rise: number;
  /** Ambient: across-fraction and depth (-1 far .. 1 near). */
  u: number;
  d: number;
  /** Drawn diameter in CSS px at unit perspective scale. */
  size: number;
  alpha: number;
  /** Index into the colour list; the last entry is the palette's white-hot. */
  color: number;
  phase: number;
  twinkle: number;
  sway: number;
}

/** Camera distance in world units; lower is a stronger perspective. */
const CAMERA = 3.2;
/** Radians per second for each shape's turn. */
const SPIN_ORBIT = 0.22;
const SPIN_COLUMN = 0.07;
const SPIN_DOME = 0.09;
/** How far above the orbit plane the camera looks down, in radians. */
const VIEW_TILT = 0.34;
/** How far each particle wanders off its path, in world units. */
const SWAY = 0.04;
/** Depth of the focal plane (+ toward the viewer), and the depth either side that stays sharp. */
const FOCUS = 0.1;
const FOCUS_BAND = 0.55;
/** Seconds to fade in on mount. */
const FADE_IN = 0.9;
/** The moment shown, frozen, to anyone who asked for reduced motion. */
const STILL_AT = 21;
/** Depth band either side of the centre plane over which layers cross-fade. */
const SEAM = 0.14;

const TAU = Math.PI * 2;

/** Base counts per shape at density 1: [specks, dots, stars, bokeh], then ambient [specks, dots, stars]. */
const COUNTS: Record<FieldShape, { body: [number, number, number, number]; dust: [number, number, number] }> = {
  orbit: { body: [120, 30, 12, 7], dust: [30, 5, 6] },
  column: { body: [130, 30, 12, 7], dust: [22, 4, 5] },
  dome: { body: [150, 26, 12, 6], dust: [28, 4, 6] },
};

/** Share of each kind drawn in the palette's white-hot rather than a colour. */
const HOT_SHARE: Record<Kind, number> = { [SPECK]: 0.3, [DOT]: 0.1, [STAR]: 0.45, [BOKEH]: 0 };

export function createFieldScene(canvas: Surface, ctx: Context2D, config: FieldConfig): ParticleScene {
  const { colors, shape, radius, speed, layer, epoch } = config;
  const field = buildField(shape, config.density, config.seed, colors.length - 1, config.spread);
  // The fade-in runs from when the scene is built, not from the mount: a
  // worker still starting up would otherwise open partway through it.
  const born = performance.timeOrigin + performance.now();

  let size: SceneSize = { width: 1, height: 1, pixelWidth: 1, pixelHeight: 1, ox: 0, oy: 0 };
  // The sprite atlas for the current theme; swapped when the theme flips.
  let atlas = getAtlas(colors, false);

  const stamp = (cell: Cell, x: number, y: number, d: number, alpha: number) => {
    if (alpha < 0.004 || x + d < 0 || x - d > size.width || y + d < 0 || y - d > size.height) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(atlas.canvas, cell.x, cell.y, cell.size, cell.size, x - d / 2, y - d / 2, d, d);
  };

  /** The whole field at time t (seconds): nothing carries over from the last frame. */
  const paint = (t: number, fade: number, light: boolean) => {
    const { width, height, ox, oy } = size;
    ctx.setTransform(size.pixelWidth / width, 0, 0, size.pixelHeight / height, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    // Additive on the dark glass, so overlapping glows bloom. On the
    // pale light-mode glass additive light would vanish into white, so
    // the particles are painted as plain colour instead.
    ctx.globalCompositeOperation = light ? "source-over" : "lighter";

    if (atlas.light !== light) atlas = getAtlas(colors, light);
    const sprites = atlas.sets;
    const U = radius * Math.min(width, height);
    const m = t * speed;
    const gain = fade * (light ? 0.8 : 1);

    const pitch = shape === "column" ? 0.04 : shape === "dome" ? VIEW_TILT * 0.6 : VIEW_TILT;
    const ct = Math.cos(pitch);
    const st = Math.sin(pitch);
    // How far the column must reach, above and below the centre, for
    // even its farthest (smallest) motes to span the box.
    const reach = Math.max(oy, height - oy) / U / (CAMERA / (CAMERA + 1.2)) + 0.25;

    for (const p of field) {
      let x: number;
      let y: number;
      let z: number;
      let edge = 1;

      if (p.ambient) {
        // Dust: laid out across the whole box rather than in the
        // shape, rising slowly.
        const v = (((p.v - p.rise * m) % 1) + 1) % 1;
        const px = p.u * width;
        const py = v * (height + 24) - 12;
        edge = clamp01(Math.min(v, 1 - v) * 12);
        drawOne(p, px, py, 1 + p.d * 0.22, p.d, t, gain * edge, sprites[p.color]!, light);
        continue;
      }

      if (shape === "orbit") {
        const a = p.a + m * SPIN_ORBIT * p.spin;
        const ox0 = Math.cos(a) * p.r;
        const oz0 = Math.sin(a) * p.r;
        const oy0 = p.h + Math.sin(t * p.sway + p.phase) * SWAY;
        x = ox0;
        y = oy0 * p.ci - oz0 * p.si;
        z = oy0 * p.si + oz0 * p.ci;
      } else if (shape === "column") {
        const a = p.a + m * SPIN_COLUMN;
        const v = (p.v + p.rise * m) % 1;
        x = Math.cos(a) * p.r + Math.sin(t * p.sway + p.phase) * SWAY;
        z = Math.sin(a) * p.r;
        y = (v * 2 - 1) * reach;
        edge = clamp01(Math.min(v, 1 - v) * 10);
      } else {
        const a = p.a + m * SPIN_DOME;
        const ring = Math.sqrt(Math.max(0, 1 - p.h * p.h)) * p.r;
        x = Math.cos(a) * ring;
        z = Math.sin(a) * ring;
        y = p.h * p.r + Math.sin(t * p.sway + p.phase) * SWAY * 0.5;
      }

      // Look down about the horizontal, then project.
      const y2 = y * ct - z * st;
      const z2 = y * st + z * ct;
      const s = CAMERA / (CAMERA - z2);
      drawOne(p, ox + x * U * s, oy - y2 * U * s, s, z2, t, gain * edge, sprites[p.color]!, light);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  /** One particle at screen (px, py), perspective scale s, depth z (+ near). */
  const drawOne = (
    p: Particle,
    px: number,
    py: number,
    s: number,
    z: number,
    t: number,
    gain: number,
    set: SpriteSet,
    light: boolean,
  ) => {
    // Which layer owns it: a smooth split across the centre plane, so
    // the back and front fields sum to one particle as it crosses.
    const front = smoothstep(-SEAM, SEAM, z);
    const share = layer === "all" ? 1 : layer === "front" ? front : 1 - front;
    if (share < 0.01) return;
    const depth = clamp01((z + 1.3) / 2.6);
    const coc = Math.abs(z - FOCUS);
    const g = gain * share;

    if (p.kind === SPECK) {
      const tw = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 3);
      // Out of focus, a speck spreads into a larger, fainter disc.
      const blur = Math.min(1.3, Math.max(0, coc - FOCUS_BAND) * 2.4);
      const alpha = (p.alpha * (0.3 + 0.7 * tw * tw) * (0.4 + 0.6 * depth)) / (1 + blur * 0.7);
      stamp(blur > 0.5 ? set.soft : set.sharp, px, py, p.size * s * (1 + blur), alpha * g);
    } else if (p.kind === DOT) {
      const tw = 0.75 + 0.25 * Math.sin(t * p.twinkle + p.phase);
      const blur = Math.max(0, coc - FOCUS_BAND) * 2;
      const d = p.size * s;
      const alpha = p.alpha * tw * (0.45 + 0.55 * depth) * g;
      stamp(set.soft, px, py, d * (3.4 + blur * 1.6), (alpha * 0.3) / (1 + blur * 0.5));
      if (blur < 0.9) stamp(set.sharp, px, py, d * 1.6, alpha * (1 - blur / 0.9));
    } else if (p.kind === STAR) {
      // Mostly a faint point, flaring into a cross every few seconds.
      const w = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
      const flare = w * w * w * w;
      const alpha = p.alpha * (0.35 + 0.65 * depth) * g;
      stamp(set.star, px, py, p.size * s * (0.45 + 0.95 * flare), alpha * (0.3 + 0.7 * flare));
      stamp(set.sharp, px, py, 5 * s, alpha);
    } else {
      const pulse = 0.8 + 0.2 * Math.sin(t * p.twinkle + p.phase);
      const d = p.size * s * (0.7 + coc * 0.6);
      stamp(set.bokeh, px, py, d, p.alpha * pulse * (0.55 + 0.45 * depth) * g * (light ? 0.25 : 0.5));
    }
  };

  return {
    resize(next) {
      size = next;
      canvas.width = next.pixelWidth;
      canvas.height = next.pixelHeight;
    },
    // The field runs on the absolute clock, not on frame steps, so it is
    // the same speed at any frame rate and on either thread.
    draw(now: number, light: boolean, mode: SceneMode) {
      if (mode === "reduced") paint(STILL_AT, 1, light);
      else paint((now - epoch) / 1000, mode === "run" ? clamp01((now - born) / 1000 / FADE_IN) : 1, light);
    },
  };
}

/** The field, laid out once from the seed. */
function buildField(shape: FieldShape, density: number, seed: number, colorCount: number, spread: number): Particle[] {
  const rand = mulberry32(seed);
  const field: Particle[] = [];
  const { body, dust } = COUNTS[shape];
  const n = (count: number) => Math.round(count * Math.max(0, density));

  const color = (kind: Kind) => (rand() < HOT_SHARE[kind] ? colorCount : Math.floor(rand() * colorCount));
  const look = (kind: Kind) => ({
    size:
      kind === SPECK ? 3 + rand() * 4 : kind === DOT ? 3 + rand() * 3 : kind === STAR ? 16 + rand() * 16 : 20 + rand() * 34,
    alpha:
      kind === SPECK
        ? 0.55 + rand() * 0.45
        : kind === DOT
          ? 0.6 + rand() * 0.4
          : kind === STAR
            ? 0.7 + rand() * 0.3
            : 0.06 + rand() * 0.08,
    color: color(kind),
    phase: rand() * TAU,
    twinkle: kind === BOKEH ? 0.3 + rand() * 0.4 : kind === STAR ? 0.5 + rand() * 1.1 : 0.8 + rand() * 2.6,
    sway: 0.15 + rand() * 0.35,
  });

  const kinds: Kind[] = [SPECK, DOT, STAR, BOKEH];
  kinds.forEach((kind, i) => {
    for (let j = 0; j < n(body[i]!); j++) {
      const bokeh = kind === BOKEH;
      let r: number;
      let h = 0;
      let incl = 0;
      if (shape === "orbit") {
        // A thick band: most particles between 0.55 and 1.25 of the
        // radius, a few strays well inside or out, and bokeh out at the
        // edge so the turn swings them right up to the lens.
        r = bokeh ? 1.05 + rand() * 0.35 : 0.5 + Math.pow(rand(), 0.8) * 0.8;
        h = gaussian(rand) * 0.3 * spread;
        incl = gaussian(rand) * 0.22;
      } else if (shape === "column") {
        r = bokeh ? 0.75 + rand() * 0.45 : 1.15 * Math.sqrt(rand());
      } else {
        r = bokeh ? 1.1 + rand() * 0.25 : 0.88 + rand() * 0.24;
        h = rand() * 2 - 1;
      }
      field.push({
        kind,
        ambient: false,
        r,
        a: rand() * TAU,
        h,
        ci: Math.cos(incl),
        si: Math.sin(incl),
        spin: 0.75 + 0.45 / Math.max(0.5, r),
        v: rand(),
        rise: (bokeh ? 0.004 : 0.008) + rand() * 0.012,
        u: 0,
        d: 0,
        ...look(kind),
      });
    }
  });

  const dustKinds: Kind[] = [SPECK, DOT, STAR];
  dustKinds.forEach((kind, i) => {
    for (let j = 0; j < n(dust[i]!); j++) {
      field.push({
        kind,
        ambient: true,
        r: 0,
        a: 0,
        h: 0,
        ci: 1,
        si: 0,
        spin: 0,
        v: rand(),
        rise: 0.006 + rand() * 0.01,
        u: rand(),
        d: rand() * 2 - 1,
        ...look(kind),
      });
    }
  });

  return field;
}

/** Small, fast, seedable PRNG: the same seed always yields the same field. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly normal, -3..3: the sum of three uniforms, recentred. */
function gaussian(rand: () => number) {
  return (rand() + rand() + rand() - 1.5) * 2;
}

/** A sprite's square in its atlas, in atlas px. */
interface Cell {
  x: number;
  y: number;
  size: number;
}

interface SpriteSet {
  sharp: Cell;
  soft: Cell;
  bokeh: Cell;
  star: Cell;
}

interface Atlas {
  canvas: CanvasImageSource;
  /** One set per colour, in the colour list's order. */
  sets: SpriteSet[];
  light: boolean;
}

/** Transparent px between cells, so filtering at a cell's edge never picks up its neighbour. */
const GUTTER = 2;
const atlasCache = new Map<string, Atlas>();

/**
 * Every sprite a field draws, for every colour, packed into one canvas:
 * a row per colour of sharp | soft | bokeh | star. Stamping from a
 * single texture lets the GPU batch a whole frame's stamps, where a
 * separate canvas per sprite forced a texture switch on nearly every
 * one. Fields with the same colours (on the same thread) share an atlas.
 */
function getAtlas(colors: readonly RGB[], light: boolean): Atlas {
  const key = `${colors.map((c) => c.join(",")).join("|")}${light ? "L" : "D"}`;
  let atlas = atlasCache.get(key);
  if (atlas) return atlas;
  const sprites = colors.map((c) => renderSprites(c, light));
  const order = ["sharp", "soft", "bokeh", "star"] as const;
  const rowHeight = Math.max(...order.map((k) => sprites[0]![k].height)) + GUTTER;
  const { canvas, g } = spriteCanvas(
    order.reduce((w, k) => w + sprites[0]![k].width + GUTTER, GUTTER),
    colors.length * rowHeight + GUTTER,
  );
  const sets = sprites.map((set, row) => {
    let x = GUTTER;
    const y = GUTTER + row * rowHeight;
    const cells = {} as SpriteSet;
    for (const k of order) {
      const img = set[k];
      // A 1:1 copy at whole px: the atlas holds exactly the sprite's pixels.
      g?.drawImage(img, x, y);
      cells[k] = { x, y, size: img.width };
      x += img.width + GUTTER;
    }
    return cells;
  });
  atlas = { canvas, sets, light };
  atlasCache.set(key, atlas);
  return atlas;
}

/**
 * Glows rendered once per colour (and theme) and stamped with drawImage,
 * which is far cheaper than a gradient or shadowBlur per particle per
 * frame. The light-mode set swaps the white-hot cores for the colour
 * itself: white on the pale glass would simply disappear.
 */
function renderSprites(c: RGB, light: boolean) {
  const hot = light ? mix(c, [20, 16, 60], 0.15) : lighten(c, 0.6);
  const core = light ? hot : ([255, 255, 255] as const);
  return {
    // A white-hot pinpoint with a faint, thin halo.
    sharp: radial(32, [
      [0, rgba(core, 1)],
      [0.18, rgba(hot, 1)],
      [0.42, rgba(c, 0.18)],
      [0.7, rgba(c, 0.05)],
      [1, rgba(c, 0)],
    ]),
    // The same light, defocused.
    soft: radial(64, [
      [0, rgba(hot, 0.8)],
      [0.3, rgba(c, 0.45)],
      [0.62, rgba(c, 0.12)],
      [1, rgba(c, 0)],
    ]),
    // A lens bokeh disc: flat, with the faintly brighter rim real ones have.
    bokeh: radial(96, [
      [0, rgba(c, 0.62)],
      [0.55, rgba(c, 0.6)],
      [0.8, rgba(hot, 0.72)],
      [0.9, rgba(c, 0.3)],
      [1, rgba(c, 0)],
    ]),
    star: starSprite(c, hot, core),
  };
}

function radial(size: number, stops: readonly (readonly [number, string])[]) {
  const { canvas, g: c } = spriteCanvas(size, size);
  if (c) {
    const r = size / 2;
    const grad = c.createRadialGradient(r, r, 0, r, r, r);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
  }
  return canvas;
}

/** A four-point glint: a small halo crossed by two long, tapering spikes. */
function starSprite(c: RGB, hot: RGB, core: RGB) {
  const size = 96;
  const r = size / 2;
  const { canvas, g } = spriteCanvas(size, size);
  if (!g) return canvas;
  g.globalCompositeOperation = "lighter";

  const halo = g.createRadialGradient(r, r, 0, r, r, r * 0.42);
  halo.addColorStop(0, rgba(core, 0.95));
  halo.addColorStop(0.2, rgba(hot, 0.3));
  halo.addColorStop(0.55, rgba(c, 0.08));
  halo.addColorStop(1, rgba(c, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  for (const vertical of [false, true]) {
    const spike = vertical ? g.createLinearGradient(r, 0, r, size) : g.createLinearGradient(0, r, size, r);
    spike.addColorStop(0, rgba(c, 0));
    spike.addColorStop(0.32, rgba(c, 0.35));
    spike.addColorStop(0.5, rgba(core, 1));
    spike.addColorStop(0.68, rgba(c, 0.35));
    spike.addColorStop(1, rgba(c, 0));
    g.fillStyle = spike;
    g.beginPath();
    const w = 1.7;
    if (vertical) {
      g.moveTo(r, 0);
      g.lineTo(r + w, r);
      g.lineTo(r, size);
      g.lineTo(r - w, r);
    } else {
      g.moveTo(0, r);
      g.lineTo(r, r - w);
      g.lineTo(size, r);
      g.lineTo(r, r + w);
    }
    g.closePath();
    g.fill();
  }
  return canvas;
}

function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(lo: number, hi: number, v: number) {
  const x = clamp01((v - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
}
