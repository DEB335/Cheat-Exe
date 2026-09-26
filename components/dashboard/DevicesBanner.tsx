"use client";

import { useEffect, useRef } from "react";

import { Laptop3D } from "@/components/dashboard/Laptop3D";
import { ParticleGlobe } from "@/components/effects/ParticleGlobe";
import { ArrowRightIcon } from "@/components/icons";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";

/**
 * The "Real-Time Active Devices" band at the top of the devices card: a
 * 3D laptop on the left, the live count, a spinning globe, and the way
 * through to the full devices page.
 *
 * `online` is the store's device count -- the same authenticated
 * sessions the table underneath lists -- so the pill never says more
 * than the table can show.
 */
export function DevicesBanner({ online, onViewAll }: { online: number; onViewAll: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, frame: 0 });

  useEffect(() => {
    const state = pointer.current;
    return () => cancelAnimationFrame(state.frame);
  }, []);

  // The laptop leans toward the pointer through two custom properties on
  // this element. Written straight to the style, at most once a frame, so
  // a mouse sweeping across the banner never re-renders React.
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pointer.current;
    state.x = event.clientX;
    state.y = event.clientY;
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      const el = hostRef.current;
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--btx", (((state.x - rect.left) / rect.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--bty", (((state.y - rect.top) / rect.height) * 2 - 1).toFixed(3));
    });
  };

  const onPointerLeave = () => {
    const state = pointer.current;
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    hostRef.current?.style.removeProperty("--btx");
    hostRef.current?.style.removeProperty("--bty");
  };

  return (
    <div
      ref={hostRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(
        "group/banner relative isolate overflow-hidden border-b border-[rgba(59,76,160,0.28)]",
        "bg-[#021026] shadow-[inset_0_1px_0_rgba(148,163,255,0.08)]",
        "lt:border-line lt:bg-[linear-gradient(90deg,#eef0ff,#f6f4ff_55%,#eef2ff)]",
      )}
    >
      {/* Ambient light: indigo behind the laptop, violet pooling on the
          floor, a haze under the globe. Static gradients only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 lt:opacity-40"
        style={{
          background: [
            "radial-gradient(ellipse 300px 170px at 70px 55%, rgba(49, 62, 190, 0.42), transparent 70%)",
            "radial-gradient(ellipse 240px 70px at 110px 100%, rgba(139, 92, 246, 0.3), transparent 70%)",
            "radial-gradient(ellipse 380px 150px at calc(100% - 372px) 115%, rgba(76, 56, 220, 0.34), transparent 70%)",
            "linear-gradient(90deg, rgba(17, 30, 85, 0.5), transparent 30%)",
          ].join(","),
        }}
      />

      {/* The globe sits between the copy and the button, and runs behind
          the button like the reference. Below xl the copy needs the room,
          so it steps back behind the button and dims. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 -z-[5] hidden w-[560px] sm:block",
          "-right-[150px] opacity-55 xl:right-[92px] xl:opacity-100 lt:opacity-70",
        )}
      >
        <ParticleGlobe hostRef={hostRef} cx={0.5} cy={1.1} radius={0.92} />
      </div>

      <div
        className={cn(
          "relative flex min-h-[140px] flex-col gap-5 px-5 py-6",
          "sm:pl-0 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:pr-[22px]",
        )}
      >
        <div className="flex min-w-0 items-center lg:flex-1">
          <Laptop3D className="-my-6 hidden shrink-0 sm:block lg:my-0" />
          <div className="min-w-0 lg:mb-[14px]">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <h3 className="font-display text-[22px] leading-[1.2] font-bold text-white sm:text-[24px] lt:text-fg">
                Real-Time Active Devices
              </h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border border-[rgba(16,185,129,0.55)] px-3 py-[6px]",
                  "bg-[linear-gradient(180deg,rgba(2,60,52,0.9),rgba(1,36,32,0.9))]",
                  "text-[12.5px] leading-none font-bold whitespace-nowrap text-[#5cf2c4] uppercase",
                  "shadow-[0_0_14px_rgba(16,185,129,0.22),inset_0_0_10px_rgba(16,185,129,0.14)]",
                  // bg-none: the dark gradient is a background-image, which
                  // a light background-color alone would sit underneath.
                  "lt:border-emerald-300 lt:bg-emerald-50 lt:bg-none lt:text-emerald-600 lt:shadow-none",
                )}
              >
                {online} Online Now
              </span>
            </div>
            <p className="mt-[7px] text-[14px] leading-5 text-[#a3b8e0] sm:text-[16px] lt:text-muted">
              Live devices connected via authenticated sessions.
            </p>
          </div>
        </div>

        <GlowButton
          variant="vivid"
          onClick={onViewAll}
          trailingIcon={<ArrowRightIcon className="size-4" />}
          className="w-full shrink-0 sm:ml-5 sm:w-auto sm:self-start lg:mb-[14px] lg:ml-0 lg:self-center"
        >
          View All Devices &amp; Controls
        </GlowButton>
      </div>
    </div>
  );
}
