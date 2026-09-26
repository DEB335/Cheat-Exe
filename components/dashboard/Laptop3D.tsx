"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/*
 * Sizes in CSS px, on the floor plane. The laptop is a real CSS 3D model
 * rather than a picture of one, so the lid can swing on its hinge and the
 * whole thing can turn toward the pointer without a second drawing.
 */
const PLATFORM = { w: 150, d: 94, t: 8 };
const BASE = { w: 112, d: 66, t: 5 };
const LID = { w: 112, h: 66 };

/**
 * The isometric view: a floor tilted away from the camera and turned so
 * the laptop faces down and to the right. The banner feeds --btx / --bty
 * (the pointer, -1..1 across it) and the model leans toward it.
 */
const WORLD =
  "rotateX(calc(61deg + var(--bty, 0) * 4deg)) rotateZ(calc(-36deg - var(--btx, 0) * 10deg))";

const face = "absolute";

/**
 * An isometric laptop on a lit plinth, its screen showing a shield.
 *
 * Idle, it is a still picture: nothing here animates on its own. Inside
 * an ancestor with `group/banner`, hovering that group swings the lid a
 * little further open and brightens the screen, and the --btx / --bty
 * custom properties (set on the same ancestor) turn it toward the
 * pointer. All of it is transform and opacity.
 */
export function Laptop3D({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none relative h-[140px] w-[218px] select-none [perspective:820px]", className)}
    >
      {/* Light spilling onto the floor: violet from the left, the screen's
          glow pooling behind the lid. Flat gradients, no blur filters. */}
      <div
        className="absolute inset-0 lt:opacity-40"
        style={{
          background: [
            "radial-gradient(ellipse 110px 60px at 22px 86%, rgba(139, 92, 246, 0.38), transparent 70%)",
            "radial-gradient(ellipse 150px 90px at 45% 58%, rgba(76, 70, 229, 0.3), transparent 72%)",
            "radial-gradient(ellipse 120px 40px at 70% 100%, rgba(168, 85, 247, 0.22), transparent 70%)",
          ].join(","),
        }}
      />
      <div
        className={cn(
          "absolute top-[26%] left-[47%] size-[120px] -translate-x-1/2 rounded-full opacity-55",
          "transition-opacity duration-500 group-hover/banner:opacity-100",
        )}
        style={{ background: "radial-gradient(circle, rgba(124, 92, 255, 0.45), rgba(124, 92, 255, 0) 65%)" }}
      />

      {/* The world: a zero-size pivot the whole model hangs off. */}
      <div
        className="absolute top-[75%] left-[55%] size-0 transition-transform duration-700 ease-smooth [transform-style:preserve-3d]"
        style={{ transform: WORLD }}
      >
        {/* Faint circuit floor, fading out toward its edges. */}
        <div
          className={face}
          style={{
            width: 300,
            height: 230,
            left: -150,
            top: -115,
            background: [
              "repeating-linear-gradient(90deg, rgba(129, 140, 248, 0.12) 0 1px, transparent 1px 30px)",
              "repeating-linear-gradient(0deg, rgba(129, 140, 248, 0.12) 0 1px, transparent 1px 30px)",
            ].join(","),
            maskImage: "radial-gradient(closest-side, #000 30%, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, #000 30%, transparent)",
          }}
        />

        <Slab
          w={PLATFORM.w}
          d={PLATFORM.d}
          t={PLATFORM.t}
          x={-PLATFORM.w / 2 + 6}
          y={-PLATFORM.d / 2 + 4}
          top="linear-gradient(135deg, #141a4a 0%, #0b0f33 45%, #080a26 100%)"
          topClass="rounded-[6px] shadow-[inset_0_0_0_1px_rgba(129,120,255,0.28),inset_0_0_22px_rgba(99,82,255,0.18)]"
          front="linear-gradient(180deg, rgba(168, 120, 255, 0.75) 0 1px, #0a0b27 1px, #05061a 100%)"
          side="linear-gradient(180deg, rgba(129, 120, 255, 0.45) 0 1px, #0c0e30 1px, #070820 100%)"
        />

        {/* Holographic panel standing at the back of the plinth. */}
        <div
          className={cn(face, "rounded-[3px] border border-[rgba(139,124,255,0.35)] bg-[rgba(99,82,255,0.07)]")}
          style={{
            width: 40,
            height: 26,
            left: PLATFORM.w / 2 - 44,
            top: -PLATFORM.d / 2 - 22,
            transformOrigin: "50% 100%",
            transform: `translateZ(${PLATFORM.t}px) rotateX(-90deg)`,
          }}
        >
          <span className="absolute top-[7px] left-[6px] h-px w-[22px] bg-[rgba(167,139,250,0.55)]" />
          <span className="absolute top-[12px] left-[6px] h-px w-[14px] bg-[rgba(167,139,250,0.35)]" />
          <span className="absolute right-[5px] bottom-[5px] size-[3px] rounded-full bg-[#c4b5fd] shadow-[0_0_6px_2px_rgba(167,139,250,0.8)]" />
        </div>

        {/* The laptop body sits on the plinth. */}
        <div
          className="absolute [transform-style:preserve-3d]"
          style={{
            width: BASE.w,
            height: BASE.d,
            left: -BASE.w / 2,
            top: -BASE.d / 2 + 6,
            transform: `translateZ(${PLATFORM.t}px)`,
          }}
        >
          {/* Soft contact shadow under the base. */}
          <div
            className={face}
            style={{
              inset: -10,
              background: "radial-gradient(closest-side, rgba(2, 3, 16, 0.75), transparent)",
              transform: "translateZ(0.5px)",
            }}
          />

          <Slab
            w={BASE.w}
            d={BASE.d}
            t={BASE.t}
            x={0}
            y={0}
            top="linear-gradient(170deg, #5b5fe0 0%, #4a4cc4 40%, #3a3aa6 100%)"
            topClass="rounded-[4px] shadow-[inset_0_0_0_1px_rgba(196,181,253,0.35)]"
            front="linear-gradient(180deg, #8b8cf5 0 1px, #34369a 1px, #232470 100%)"
            side="linear-gradient(180deg, #7c7ef0 0 1px, #2c2e8a 1px, #1c1d62 100%)"
          >
            {/* The screen's light washing over the back of the deck. */}
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-[4px] bg-[linear-gradient(180deg,rgba(167,139,250,0.4),transparent)]" />
            {/* Keyboard: dark keys in a grid of deck-coloured gaps. */}
            <span
              className="absolute top-[7px] right-[9px] left-[9px] h-[29px] rounded-[2px] shadow-[0_0_0_1px_rgba(10,10,40,0.6)]"
              style={{
                background: [
                  "repeating-linear-gradient(90deg, rgba(88, 92, 222, 0.95) 0 1px, transparent 1px 7.5px)",
                  "repeating-linear-gradient(180deg, rgba(88, 92, 222, 0.95) 0 1px, transparent 1px 5.8px)",
                  "#0c0d2b",
                ].join(","),
              }}
            />
            <span className="absolute top-[41px] left-1/2 h-[17px] w-[38px] -translate-x-1/2 rounded-[2px] border border-[rgba(196,181,253,0.35)] bg-[rgba(24,24,80,0.45)]" />
          </Slab>

          {/* The lid, hinged on the back edge of the deck. */}
          <div
            className={cn(
              "absolute [transform-style:preserve-3d] transition-transform duration-700 ease-smooth",
              "[--lid:-77deg] group-hover/banner:[--lid:-66deg]",
            )}
            style={{
              width: LID.w,
              height: LID.h,
              left: 0,
              top: -LID.h,
              transformOrigin: "50% 100%",
              transform: `translateZ(${BASE.t}px) rotateX(var(--lid))`,
            }}
          >
            {/* Shell edge on the left, the side the camera can see. */}
            <div
              className={face}
              style={{
                width: 3,
                height: LID.h,
                left: -3,
                top: 0,
                transformOrigin: "100% 50%",
                transform: "rotateY(-90deg)",
                background: "linear-gradient(180deg, #a78bfa, #6d5df5)",
              }}
            />
            {/* Rim, bezel, then the display. */}
            <div
              className={cn(
                face,
                "inset-0 rounded-[6px] bg-[linear-gradient(160deg,#b4a5ff,#6d5df5_40%,#4338ca)] p-[1.5px]",
                "shadow-[0_0_14px_rgba(124,92,255,0.55)]",
              )}
            >
              <div className="relative size-full rounded-[5px] bg-[#07081f] p-[3.5px]">
                <span className="absolute top-[1.5px] left-1/2 size-[1.5px] -translate-x-1/2 rounded-full bg-[#4b4f8a]" />
                <div
                  className="relative flex size-full items-center justify-center overflow-hidden rounded-[3px]"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 46%, #5a46f2 0%, #3b2bc4 34%, #22188e 66%, #140e5c 100%)",
                  }}
                >
                  {/* Brighter wash that fades in on hover. */}
                  <span
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/banner:opacity-100"
                    style={{
                      background: "radial-gradient(circle at 50% 46%, rgba(167, 139, 250, 0.55), transparent 62%)",
                    }}
                  />
                  <span
                    className="absolute size-[54px] rounded-full opacity-80"
                    style={{ background: "radial-gradient(circle, rgba(129, 140, 248, 0.6), transparent 68%)" }}
                  />
                  <Shield uid={uid} />
                  {/* Glass sheen. */}
                  <span className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.03)_34%,transparent_34.5%)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A box on the floor: its top face, plus the front and left faces --
 * the two the camera can see from this angle.
 */
function Slab({
  w,
  d,
  t,
  x,
  y,
  top,
  topClass,
  front,
  side,
  children,
}: {
  w: number;
  d: number;
  t: number;
  x: number;
  y: number;
  top: string;
  topClass?: string;
  front: string;
  side: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="absolute [transform-style:preserve-3d]"
      style={{ width: w, height: d, left: x, top: y }}
    >
      <div
        className={cn(face, "inset-0", topClass)}
        style={{ background: top, transform: `translateZ(${t}px)` }}
      >
        {children}
      </div>
      <div
        className={face}
        style={{
          width: w,
          height: t,
          left: 0,
          top: d,
          background: front,
          transformOrigin: "50% 0",
          transform: "rotateX(90deg)",
        }}
      />
      <div
        className={face}
        style={{
          width: t,
          height: d,
          left: -t,
          top: 0,
          background: side,
          transformOrigin: "100% 50%",
          transform: "rotateY(90deg)",
        }}
      />
    </div>
  );
}

function Shield({ uid }: { uid: string }) {
  const stroke = `${uid}-shield-stroke`;
  const fill = `${uid}-shield-fill`;
  return (
    <svg viewBox="0 0 40 46" width="27" height="31" className="relative drop-shadow-[0_0_5px_rgba(167,139,250,0.9)]">
      <defs>
        <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9d5ff" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(129, 140, 248, 0.45)" />
          <stop offset="1" stopColor="rgba(49, 36, 160, 0.65)" />
        </linearGradient>
      </defs>
      <path
        d="M20 3 36 9v12.5C36 32 28.5 39.5 20 43 11.5 39.5 4 32 4 21.5V9Z"
        fill={`url(#${fill})`}
        stroke={`url(#${stroke})`}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="m13 23.5 5 5 9.5-10"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
