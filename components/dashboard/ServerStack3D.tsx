"use client";

import { useEffect, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";

/*
 * A CSS-3D server stack for the System Performance card.
 *
 * Everything is laid out on one flat "world" plane that is tipped back
 * and turned 45deg, so a plain div becomes a floor tile and translateZ is
 * height above that floor. Each box is only the three faces the camera
 * can ever see (top, front-left, front-right) -- the tilt never turns far
 * enough to show the others, so they would be DOM for nothing.
 *
 * Motion budget: nothing here repaints while idle. The bob is one
 * transform animation (compositor only) that pauses off screen, in a
 * hidden tab, and never starts under reduced motion. The hover tilt
 * writes two custom properties at most once per frame, and only while
 * the pointer is actually moving over the card; CSS transitions do the
 * easing, so there is no rAF loop to keep alive.
 */

/** Plane px. The world is ~56deg off vertical, so heights read at ~0.83x on screen. */
const SLAB = 76;
const SLAB_H = 19;
const SLAB_GAP = 3;
const BASE_Z = 18;

type Face = { className?: string; children?: React.ReactNode };

function Box({
  w,
  d,
  h,
  x = 0,
  y = 0,
  z = 0,
  lift = 0,
  top,
  south,
  east,
  className,
}: {
  w: number;
  d: number;
  h: number;
  /** Centre of the footprint on the plane. */
  x?: number;
  y?: number;
  /** Height of the underside above the floor. */
  z?: number;
  /** Extra height per unit of --spread (the hover separation). */
  lift?: number;
  top?: Face;
  /** The face toward the viewer's lower left. */
  south?: Face;
  /** The face toward the viewer's lower right. */
  east?: Face;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute [transform-style:preserve-3d]",
        "transition-transform duration-500 ease-smooth",
        className,
      )}
      style={{
        left: x - w / 2,
        top: y - d / 2,
        width: w,
        height: d,
        transform: `translateZ(calc(${z}px + var(--spread) * ${lift}px))`,
      }}
    >
      <div
        className={cn("absolute inset-0", top?.className)}
        style={{ transform: `translateZ(${h}px)` }}
      >
        {top?.children}
      </div>
      <div
        className={cn("absolute left-0 origin-top-left", south?.className)}
        style={{ top: d, width: w, height: h, transform: `translateZ(${h}px) rotateX(-90deg)` }}
      >
        {south?.children}
      </div>
      <div
        className={cn("absolute origin-top-left", east?.className)}
        style={{
          left: w,
          top: d,
          width: d,
          height: h,
          transform: `translateZ(${h}px) rotateZ(-90deg) rotateX(-90deg)`,
        }}
      >
        {east?.children}
      </div>
    </div>
  );
}

/**
 * A translucent sheet standing on the floor, facing the viewer's lower
 * right. (x, y) is its left end on the plane; it runs `w` px away from
 * the viewer from there.
 */
function Panel({
  x,
  y,
  z,
  w,
  h,
  className,
  children,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("absolute origin-top-left overflow-hidden rounded-[6px] border", className)}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `translateZ(${z + h}px) rotateZ(-90deg) rotateX(-90deg)`,
      }}
    >
      {children}
    </div>
  );
}

/** LED dash on a slab front. */
function Led({ className }: { className: string }) {
  return <span className={cn("absolute h-[3px] rounded-full", className)} />;
}

const slabFaces = (i: number) => ({
  top: {
    className: cn(
      "rounded-[7px] border border-[rgba(168,176,255,0.6)]",
      "bg-[linear-gradient(135deg,#3b3fc4_0%,#4d44df_50%,#7a55f0_100%)]",
    ),
  },
  south: {
    className: cn(
      "rounded-b-[5px] border-t-[1.5px] border-[#7282ff]",
      "bg-[linear-gradient(180deg,#283090_0%,#171c62_60%,#10144a_100%)]",
    ),
    children: (
      <>
        <Led className="top-[8px] left-[9px] w-[9px] bg-[#ff3d8b] shadow-[0_0_5px_#ff3d8b]" />
        <Led className="top-[8px] left-[34px] w-[3px] bg-[#ff5c9a] shadow-[0_0_5px_#ff5c9a]" />
        {/* Light spill from the platform on the lowest slab. */}
        {i === 0 && (
          <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(90,120,255,0.45),transparent_60%)]" />
        )}
      </>
    ),
  },
  east: {
    className: cn(
      "rounded-b-[5px] border-t-[1.5px] border-[#8a7dff]",
      "bg-[linear-gradient(180deg,#2c2a9c_0%,#1a1868_60%,#120f4c_100%)]",
    ),
    children: (
      <>
        <Led className="top-[8px] left-[20px] w-[12px] bg-[#8fb2ff] shadow-[0_0_5px_#6d8dff]" />
        <Led className="top-[8px] left-[50px] w-[5px] bg-[#c7d4ff] shadow-[0_0_5px_#6d8dff]" />
      </>
    ),
  },
});

export function ServerStack3D({
  hostRef,
  className,
}: {
  /** Element whose pointer movement steers the tilt (the whole card). */
  hostRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const scene = sceneRef.current;
    const world = worldRef.current;
    const float = floatRef.current;
    if (!host || !scene || !world || !float) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    // Idle bob: one compositor animation, paused whenever nobody can see it.
    const bob = float.animate(
      [{ transform: "translateZ(0px)" }, { transform: "translateZ(6px)" }],
      { duration: 3200, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
    );
    let onScreen = true;
    const sync = () => {
      if (onScreen && !document.hidden) bob.play();
      else bob.pause();
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    io.observe(scene);
    document.addEventListener("visibilitychange", sync);

    // Hover tilt: lean toward the pointer. Reads layout once per frame at
    // most, and only while the pointer is moving over the card.
    let raf = 0;
    let cx = 0;
    let cy = 0;
    let inside = false;
    const write = () => {
      raf = 0;
      let tx = 0;
      let ty = 0;
      if (inside) {
        // The world is a zero-size box, so its rect is the stack's centre.
        const card = host.getBoundingClientRect();
        const origin = world.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (cx - origin.left) / (card.width * 0.5)));
        ty = Math.max(-1, Math.min(1, (cy - origin.top) / (card.height * 0.9)));
      }
      scene.style.setProperty("--tilt-x", tx.toFixed(3));
      scene.style.setProperty("--tilt-y", ty.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      inside = true;
      cx = event.clientX;
      cy = event.clientY;
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onLeave = () => {
      inside = false;
      if (!raf) raf = requestAnimationFrame(write);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    return () => {
      bob.cancel();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [hostRef]);

  return (
    <div
      ref={sceneRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 [--spread:0] [--tilt-x:0] [--tilt-y:0]",
        "[perspective:1600px] [perspective-origin:calc(100%-128px)_176px]",
        "group-hover/perf:[--spread:1] motion-reduce:group-hover/perf:[--spread:0]",
        "lt:opacity-80",
        className,
      )}
    >
      {/* Halo behind the stack. Flat, so it is painted once. */}
      <div
        className={cn(
          "absolute top-[176px] right-[128px] h-[260px] w-[340px] translate-x-1/2 -translate-y-[58%] rounded-full",
          "bg-[radial-gradient(closest-side,rgba(96,88,255,0.4),rgba(124,58,237,0.14)_55%,transparent)]",
          "opacity-80 transition-opacity duration-500 group-hover/perf:opacity-100",
          "lt:bg-[radial-gradient(closest-side,rgba(124,58,237,0.16),transparent)]",
        )}
      />

      <div
        ref={worldRef}
        className={cn(
          "absolute top-[176px] right-[128px] size-0 [transform-style:preserve-3d]",
          "transition-transform duration-700 ease-smooth",
          "[transform:rotateX(calc(56deg-var(--tilt-y)*7deg))_rotateZ(calc(45deg+var(--tilt-x)*10deg))]",
        )}
      >
        {/* Floor grid, fading out from the stack. */}
        <div
          className={cn(
            "absolute top-[-380px] left-[-380px] size-[760px]",
            "bg-[linear-gradient(rgba(104,112,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(104,112,255,0.09)_1px,transparent_1px)]",
            "bg-[size:38px_38px] bg-[position:-1px_-1px]",
            "[mask-image:radial-gradient(closest-side,#000_20%,transparent_85%)]",
            "lt:bg-[linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)]",
          )}
          style={{ transform: "translateZ(-1px)" }}
        />

        {/* Background props: faint glass and dark boxes, as in the reference. */}
        <Box
          w={60}
          d={150}
          h={10}
          x={-205}
          y={140}
          top={{ className: "rounded-[6px] border border-[rgba(70,86,200,0.12)] bg-[rgba(10,15,50,0.5)]" }}
          south={{ className: "border-t border-[rgba(70,86,200,0.18)] bg-[rgba(6,9,32,0.8)]" }}
          east={{ className: "border-t border-[rgba(70,86,200,0.18)] bg-[rgba(8,11,40,0.75)]" }}
        />
        <Box
          w={26}
          d={26}
          h={14}
          x={-100}
          y={170}
          top={{ className: "rounded-[4px] border border-[rgba(110,130,255,0.3)] bg-[#161d5c]" }}
          south={{ className: "bg-[#0d1240]" }}
          east={{ className: "bg-[#10164a]" }}
        />
        <Box
          w={40}
          d={40}
          h={20}
          x={82}
          y={-82}
          top={{ className: "rounded-[5px] border border-[rgba(130,110,255,0.3)] bg-[#17144e]" }}
          south={{ className: "bg-[#0e0c38]" }}
          east={{ className: "bg-[#120f42]" }}
        />
        <Panel
          x={-258}
          y={216}
          z={22}
          w={112}
          h={58}
          className="border-[rgba(120,136,255,0.2)] bg-[linear-gradient(180deg,rgba(34,42,130,0.3),rgba(18,22,80,0.16))]"
        >
          <span className="absolute top-[16px] left-[14px] h-[5px] w-[64px] rounded-full bg-[rgba(90,130,255,0.42)] shadow-[0_0_8px_rgba(90,130,255,0.4)]" />
          <span className="absolute top-[30px] left-[14px] h-[4px] w-[82px] rounded-full bg-[rgba(214,190,90,0.3)] shadow-[0_0_8px_rgba(214,190,90,0.25)]" />
        </Panel>
        <Panel
          x={-300}
          y={272}
          z={8}
          w={60}
          h={50}
          className="border-[rgba(120,136,255,0.12)] bg-[rgba(30,38,120,0.14)]"
        />
        <Panel
          x={-92}
          y={104}
          z={14}
          w={42}
          h={52}
          className="border-[rgba(200,120,255,0.45)] bg-[rgba(60,40,150,0.28)]"
        >
          <span className="absolute top-[14px] left-[8px] h-[2px] w-[20px] bg-[rgba(200,170,255,0.55)]" />
          <span className="absolute top-[22px] left-[8px] h-[2px] w-[14px] bg-[rgba(200,170,255,0.45)]" />
          <span className="absolute top-[30px] left-[8px] h-[2px] w-[18px] bg-[rgba(200,170,255,0.35)]" />
        </Panel>

        {/* Plinth: a wide dark plate, then the lit platform on it. */}
        <Box
          w={136}
          d={136}
          h={12}
          top={{
            className: cn(
              "rounded-[14px] border border-[#1e2a74]",
              "bg-[linear-gradient(135deg,#0b1038,#070a26)]",
            ),
          }}
          south={{ className: "rounded-b-[6px] border-t border-[#2a3690] bg-[#060920]" }}
          east={{ className: "rounded-b-[6px] border-t border-[#2e3296] bg-[#080a26]" }}
        />
        <Box
          w={100}
          d={100}
          h={6}
          z={12}
          top={{
            className: "rounded-[12px] border border-[#3b47c9] bg-[#0c1142]",
            children: (
              <>
                <span className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(closest-side,rgba(116,126,255,0.6),rgba(116,126,255,0.12)_70%,transparent)] opacity-80 transition-opacity duration-500 group-hover/perf:opacity-100" />
                <span className="absolute inset-[8px] rounded-[9px] border-[1.5px] border-[#7383ff] shadow-[0_0_12px_#5b6cff,inset_0_0_10px_rgba(91,108,255,0.55)]" />
              </>
            ),
          }}
          south={{ className: "border-t border-[#4c5ae0] bg-[#0a0e36]" }}
          east={{ className: "border-t border-[#5b56e6] bg-[#0c0e3c]" }}
        />

        {/* The stack itself; this wrapper carries the idle bob. */}
        <div ref={floatRef} className="absolute size-0 [transform-style:preserve-3d]">
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              w={SLAB}
              d={SLAB}
              h={SLAB_H}
              z={BASE_Z + i * (SLAB_H + SLAB_GAP)}
              lift={i * 5 + 1}
              {...slabFaces(i)}
            />
          ))}
          <Box
            w={50}
            d={50}
            h={6}
            z={BASE_Z + 3 * (SLAB_H + SLAB_GAP) - SLAB_GAP}
            lift={17}
            top={{
              className: cn(
                "rounded-[6px] border border-[rgba(190,180,255,0.75)]",
                "bg-[linear-gradient(135deg,#3a36b8_0%,#4a3fd4_55%,#8a6cff_100%)]",
                "shadow-[0_0_14px_rgba(140,120,255,0.55)]",
              ),
            }}
            south={{ className: "bg-[linear-gradient(180deg,#6d64ff,#3b35b0)]" }}
            east={{ className: "bg-[linear-gradient(180deg,#8a70ff,#4a3cc0)]" }}
          />
        </div>
      </div>
    </div>
  );
}
