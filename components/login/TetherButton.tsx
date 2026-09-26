"use client";

import { useEffect, useRef } from "react";

import { ArrowRightIcon } from "@/components/icons";
import { playClick, playDodge, playSnap } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { pageZoom } from "@/lib/zoom";

export type TetherState = "empty" | "checking" | "ready" | "invalid";

// The cord takes the pill's colours: teal while it waits, amber while
// the server checks, a cyan core in a blue haze once it is home.
const COLORS: Record<TetherState, { stroke: string; glow: string }> = {
  empty: { stroke: "#2dd4bf", glow: "rgba(45, 212, 191, 0.4)" },
  checking: { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)" },
  ready: { stroke: "#38bdf8", glow: "rgba(37, 99, 235, 0.45)" },
  invalid: { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.4)" },
};

/**
 * The runaway sign-in button. It dodges the cursor on an elastic cord
 * until the typed credentials are confirmed real, then snaps home,
 * lights up and locks.
 *
 * The original decided "locked" by comparing the typed password against
 * credentials held in localStorage, which anyone could edit. The server
 * decides now (see /api/auth/verify); until it says yes the button both
 * runs away *and* stays disabled, so catching it achieves nothing.
 */
export function TetherButton({
  state,
  label,
  disabled,
  bolt,
}: {
  state: TetherState;
  label: string;
  disabled: boolean;
  /** Incremented by the parent on a failed submit to fling the button. */
  bolt: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const stateRef = useRef(state);
  const snapped = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Play the lock chord the first time the credentials come back valid.
  useEffect(() => {
    if (state === "ready" && !snapped.current) {
      snapped.current = true;
      playSnap();
    } else if (state !== "ready") {
      snapped.current = false;
    }
  }, [state]);

  // A rejected submit throws the button sideways.
  useEffect(() => {
    if (bolt === 0) return;
    target.current.x = (Math.random() > 0.5 ? 1 : -1) * 120;
    target.current.y = -35;
  }, [bolt]);

  // A dodging button must not be reachable by keyboard either: Tab used
  // to focus it, which snapped it home for free.
  const locked = state === "ready";

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    if (!track || !canvas || !button) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The canvas, the button's translate and the cord are all in CSS
    // pixels. The rect is in real screen pixels, so it is brought back to
    // CSS ones first: sized straight off it, the backing store was
    // stretched unevenly over the canvas's box on the zoomed desktop page
    // and the cord overshot the button it is tied to.
    const resize = () => {
      const zoom = pageZoom();
      const rect = track.getBoundingClientRect();
      canvas.width = rect.width / zoom + 300;
      canvas.height = rect.height / zoom + 200;
    };
    resize();

    const onMouseMove = (event: MouseEvent) => {
      // Locked home once the server has confirmed the credentials.
      if (stateRef.current === "ready") {
        target.current.x = 0;
        target.current.y = 0;
        return;
      }

      const trackRect = track.getBoundingClientRect();
      const inside =
        event.clientX >= trackRect.left &&
        event.clientX <= trackRect.right &&
        event.clientY >= trackRect.top &&
        event.clientY <= trackRect.bottom;

      if (!inside) {
        target.current.x *= 0.85;
        target.current.y *= 0.85;
        return;
      }

      // Real screen pixels in, CSS pixels out, so the reach and travel
      // below mean the same thing at any page zoom.
      const zoom = pageZoom();
      const btnRect = button.getBoundingClientRect();
      const dx = (event.clientX - (btnRect.left + btnRect.width / 2)) / zoom;
      const dy = (event.clientY - (btnRect.top + btnRect.height / 2)) / zoom;
      const distance = Math.hypot(dx, dy);

      const threshold = 110;
      const maxTravel = 135;

      if (distance < threshold) {
        playDodge();
        const angle = Math.atan2(dy, dx) + Math.PI;
        const force = (1 - distance / threshold) * maxTravel;
        target.current.x = Math.max(-140, Math.min(140, Math.cos(angle) * force));
        // Vertical travel is damped so the button stays on the track.
        target.current.y = Math.max(-42, Math.min(42, Math.sin(angle) * force * 0.7));
      } else if (distance > threshold + 60) {
        target.current.x *= 0.88;
        target.current.y *= 0.88;
      }
    };

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);

      const spring = stateRef.current === "ready" ? 0.28 : 0.18;
      pos.current.x += (target.current.x - pos.current.x) * spring;
      pos.current.y += (target.current.y - pos.current.y) * spring;
      button.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const anchorX = canvas.width / 2;
      const anchorY = canvas.height / 2;
      const tipX = anchorX + pos.current.x;
      const tipY = anchorY + pos.current.y;
      const dist = Math.hypot(pos.current.x, pos.current.y);
      if (dist <= 2.5) return;

      const midX = (anchorX + tipX) / 2;
      const midY = (anchorY + tipY) / 2 + pos.current.y * 0.15;
      const { stroke, glow } = COLORS[stateRef.current];

      ctx.save();
      // Outer glow pass.
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(2, 6 - dist / 40);
      ctx.lineCap = "round";
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Bright core.
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.5, 3.5 - dist / 60);
      ctx.stroke();
      ctx.restore();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  const invalid = state === "invalid";
  const checking = state === "checking";
  // The arrow disc says "go"; it steps aside while a check or a sign-in
  // is in flight so the longer label can sit in the middle.
  const showArrow = !disabled && !checking;

  return (
    <div
      ref={trackRef}
      // The rim is an inset shadow rather than a border: a border would
      // shrink the padding box the canvas is sized against and stretch
      // the cord off the button by a pixel or two.
      className={cn(
        "relative mt-6 flex h-[84px] w-full items-center justify-center rounded-[42px]",
        "bg-[linear-gradient(to_bottom,rgba(15,23,42,0.6),rgba(8,14,30,0.55))]",
        "shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35),inset_0_3px_10px_rgba(0,0,0,0.55),inset_0_-1px_0_rgba(147,197,253,0.12),0_0_22px_rgba(59,130,246,0.18)]",
      )}
    >
      {/* The home slot: a ghost of the pill marking where it belongs. */}
      <div
        className={cn(
          "pointer-events-none absolute flex h-[52px] w-[170px] items-center justify-center rounded-full",
          "border-2 border-dashed bg-white/[0.02] transition-all duration-350",
          locked
            ? "border-[rgba(45,212,191,0.75)] bg-[rgba(31,209,165,0.06)] shadow-[0_0_22px_rgba(31,209,165,0.3),inset_0_0_14px_rgba(45,212,191,0.12)]"
            : invalid
              ? "border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.05)] shadow-[0_0_15px_rgba(239,68,68,0.15)]"
              : checking
                ? "border-[rgba(245,158,11,0.6)] bg-[rgba(245,158,11,0.05)] shadow-[0_0_14px_rgba(245,158,11,0.12)]"
                : "border-[rgba(96,165,250,0.3)]",
        )}
      >
        <div
          className={cn(
            "flex size-[22px] items-center justify-center rounded-full border-2 transition-all duration-350",
            "after:block after:size-1.5 after:rounded-full after:transition-all after:duration-350 after:content-['']",
            locked
              ? "border-[rgba(45,212,191,0.6)] bg-[rgba(31,209,165,0.2)] after:bg-[#2dd4bf]"
              : invalid
                ? "border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.2)] after:bg-[#ef4444]"
                : checking
                  ? "border-[rgba(245,158,11,0.6)] bg-[rgba(245,158,11,0.2)] after:animate-pulse after:bg-[#f59e0b]"
                  : "border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.1)] after:bg-[#2dd4bf]",
          )}
        />
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute top-[-100px] left-[-150px] z-[15] h-[calc(100%+200px)] w-[calc(100%+300px)]"
      />

      <button
        ref={buttonRef}
        type="submit"
        // Unclickable until the credentials check out. The dodge is
        // driven by a window listener, so it keeps running regardless.
        disabled={disabled || !locked}
        tabIndex={locked ? 0 : -1}
        aria-label={locked ? label : "Sign in -- enter valid credentials to unlock"}
        onFocus={() => {
          if (!locked) return;
          target.current.x = 0;
          target.current.y = 0;
          playClick();
        }}
        className={cn(
          "group absolute z-20 flex h-[52px] w-[170px] items-center justify-center",
          "rounded-full border text-[16px] font-bold whitespace-nowrap",
          "transition-[background,color,box-shadow,border-color,filter] duration-300",
          showArrow ? "pr-[40px] pl-4" : "px-4",
          locked ? "cursor-pointer" : "cursor-not-allowed",
          disabled && "cursor-wait",
          locked
            ? [
                // The full look: a glossy teal-to-blue pill with a blue halo.
                "border-white/25 text-white [text-shadow:0_1px_2px_rgba(15,23,42,0.4)]",
                "bg-[linear-gradient(90deg,#1fd1a5_0%,#2dd4bf_18%,#3b82f6_64%,#2563eb_100%)]",
                "shadow-[0_0_22px_rgba(56,189,248,0.5),0_0_44px_rgba(37,99,235,0.32),0_8px_20px_rgba(0,0,0,0.45),inset_0_-2px_6px_rgba(15,23,42,0.3)]",
                "enabled:hover:brightness-110",
                "enabled:hover:shadow-[0_0_28px_rgba(56,189,248,0.65),0_0_56px_rgba(37,99,235,0.42),0_8px_20px_rgba(0,0,0,0.45),inset_0_-2px_6px_rgba(15,23,42,0.3)]",
              ]
            : invalid
              ? [
                  "border-[rgba(248,113,113,0.5)] text-[#fecaca]",
                  "bg-[#0a1122] bg-[linear-gradient(90deg,rgba(239,68,68,0.6),rgba(185,28,28,0.55))]",
                  "shadow-[0_0_22px_rgba(239,68,68,0.4),0_8px_20px_rgba(0,0,0,0.45)]",
                ]
              : checking
                ? [
                    "border-[rgba(245,158,11,0.45)] text-[#fcd34d]",
                    "bg-[#0a1122] bg-[linear-gradient(90deg,rgba(245,158,11,0.3),rgba(217,119,6,0.2))]",
                    "shadow-[0_0_14px_rgba(245,158,11,0.2),0_8px_20px_rgba(0,0,0,0.4)]",
                  ]
                : [
                    // Not available yet: the same pill, washed out to glass.
                    "border-white/12 text-white/55",
                    // A solid base under the tint: the home slot's marker sits right
                    // behind the label and would otherwise show through it.
                    "bg-[#0a1122] bg-[linear-gradient(90deg,rgba(31,209,165,0.34),rgba(59,130,246,0.38))]",
                    "shadow-[0_0_14px_rgba(45,212,191,0.14),0_8px_20px_rgba(0,0,0,0.4)]",
                  ],
        )}
      >
        {/* Amber heartbeat while the server makes up its mind. */}
        {checking && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse rounded-full shadow-[0_0_24px_rgba(245,158,11,0.55)] motion-reduce:animate-none"
          />
        )}

        {/* Glass sheen across the top half. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-[6px] top-[2px] h-[46%] rounded-full transition-opacity duration-300",
            "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.5),rgba(255,255,255,0.06))]",
            locked ? "opacity-100" : invalid ? "opacity-60" : "opacity-40",
          )}
        />

        <span className="relative">{label}</span>

        {showArrow && (
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 right-[7px] flex size-9 -translate-y-1/2 items-center justify-center rounded-full border",
              "transition-[background,color,border-color,box-shadow] duration-300",
              locked
                ? "border-white/40 bg-[rgba(30,64,175,0.55)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_10px_rgba(37,99,235,0.5)]"
                : invalid
                  ? "border-[rgba(254,202,202,0.35)] bg-[rgba(127,29,29,0.45)] text-[#fecaca]"
                  : "border-white/15 bg-white/[0.04] text-white/45",
            )}
          >
            <ArrowRightIcon
              className={cn(
                "size-[18px] transition-transform duration-300",
                locked && "group-enabled:group-hover:translate-x-[3px]",
              )}
              strokeWidth={2.25}
            />
          </span>
        )}
      </button>
    </div>
  );
}
