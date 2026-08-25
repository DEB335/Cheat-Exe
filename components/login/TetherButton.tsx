"use client";

import { useEffect, useRef } from "react";

import { playClick, playDodge, playSnap } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export type TetherState = "empty" | "ready" | "invalid";

const COLORS: Record<TetherState, { stroke: string; glow: string }> = {
  empty: { stroke: "#2dd4bf", glow: "rgba(45, 212, 191, 0.4)" },
  ready: { stroke: "#2dd4bf", glow: "rgba(45, 212, 191, 0.4)" },
  invalid: { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.4)" },
};

/**
 * The runaway sign-in button. It dodges the cursor on an elastic cord
 * until both fields are filled, then snaps home and locks.
 *
 * The original decided "locked" by comparing the typed password against
 * credentials held in localStorage. Those live on the server now, so
 * locking keys off the form being complete and the red state comes from
 * a rejected submit -- the choreography is unchanged.
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

  // Play the lock chord the first time the form becomes complete.
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

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    if (!track || !canvas || !button) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = track.getBoundingClientRect();
      canvas.width = rect.width + 300;
      canvas.height = rect.height + 200;
    };
    resize();

    const onMouseMove = (event: MouseEvent) => {
      // Locked home once the form is complete.
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

      const btnRect = button.getBoundingClientRect();
      const dx = event.clientX - (btnRect.left + btnRect.width / 2);
      const dy = event.clientY - (btnRect.top + btnRect.height / 2);
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

  const locked = state === "ready";
  const invalid = state === "invalid";

  return (
    <div
      ref={trackRef}
      className="relative mt-6 flex h-[84px] w-full items-center justify-center rounded-[42px] bg-[#090d10] shadow-[inset_0_3px_8px_rgba(0,0,0,0.6)]"
    >
      <div
        className={cn(
          "pointer-events-none absolute flex h-[52px] w-[140px] items-center justify-center rounded-[26px]",
          "border-2 border-dashed transition-all duration-350",
          locked
            ? "border-[rgba(16,185,129,0.7)] bg-[rgba(16,185,129,0.05)] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            : invalid
              ? "border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.05)] shadow-[0_0_15px_rgba(239,68,68,0.15)]"
              : "border-[rgba(45,212,191,0.4)]",
        )}
      >
        <div
          className={cn(
            "flex size-[22px] items-center justify-center rounded-full border-2 transition-all duration-350",
            "after:block after:size-1.5 after:rounded-full after:transition-all after:duration-350 after:content-['']",
            locked
              ? "border-[rgba(16,185,129,0.6)] bg-[rgba(16,185,129,0.2)] after:bg-[#10b981]"
              : invalid
                ? "border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.2)] after:bg-[#ef4444]"
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
        disabled={disabled}
        onFocus={() => {
          target.current.x = 0;
          target.current.y = 0;
          playClick();
        }}
        className={cn(
          "animate-button-shimmer absolute z-20 flex h-[52px] w-[144px] cursor-pointer items-center justify-center gap-2",
          "rounded-[26px] text-[16px] font-bold [background-size:200%_200%]",
          "shadow-[0_5px_15px_rgba(0,0,0,0.2)]",
          "transition-[background,color,box-shadow] duration-300",
          "disabled:cursor-wait",
          locked
            ? [
                "border-none bg-[linear-gradient(to_bottom,#0f402b,#10b981)] text-[#6ee7b7]",
                "shadow-[0_0_25px_rgba(16,185,129,0.35),0_10px_25px_rgba(0,0,0,0.5)]",
                "hover:bg-[linear-gradient(to_bottom,#135237,#059669)] hover:text-white",
                "hover:shadow-[0_0_30px_rgba(16,185,129,0.5),0_10px_25px_rgba(0,0,0,0.5)]",
              ]
            : invalid
              ? [
                  "border-none bg-[linear-gradient(to_bottom,#400f13,#ef4444)] text-[#fca5a5]",
                  "shadow-[0_0_20px_rgba(239,68,68,0.25),0_10px_25px_rgba(0,0,0,0.5)]",
                ]
              : [
                  "border border-[rgba(45,212,191,0.25)] bg-[#182824] text-[#72a294]",
                  "hover:bg-[#1c322d] hover:text-[#a5c3b9]",
                  "hover:shadow-[0_8px_20px_rgba(45,212,191,0.15)]",
                ],
        )}
      >
        {label}
      </button>
    </div>
  );
}
