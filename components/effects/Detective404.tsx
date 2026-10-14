"use client";

import React, { useEffect, useRef, useState } from "react";

interface Detective404Props {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  onBack?: () => void;
  backText?: string;
}

export function Detective404({
  title = "404 - NOT FOUND",
  subtitle = "The floor has been swept twice, but nobody is home. Your session may have expired.",
  badgeText = "INVESTIGATING",
  onBack,
  backText = "Back to login",
}: Detective404Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse target
  const mousePos = useRef({ x: -200, y: -200 });
  // Magnifier glass position (smooth lerp follower)
  const [glassPos, setGlassPos] = useState({ x: -200, y: -200 });
  // Bird/character position (smooth walking follower)
  const [birdPos, setBirdPos] = useState({ x: 200, y: 300, facing: 1, walking: false });
  const birdState = useRef({ x: 200, y: 300, facing: 1, stepPhase: 0, isMoving: false });

  // Footprints on the floor
  const [footprints, setFootprints] = useState<Array<{ id: number; x: number; y: number; angle: number; side: number }>>([]);
  const footstepCounter = useRef(0);
  const lastFootstepDist = useRef(0);

  useEffect(() => {
    // Center start
    if (typeof window !== "undefined") {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mousePos.current = { x: cx, y: cy };
      setGlassPos({ x: cx, y: cy });
      birdState.current.x = cx - 140;
      birdState.current.y = cy + 10;
      setBirdPos({ x: cx - 140, y: cy + 10, facing: 1, walking: false });
    }

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", onMouseMove);

    let animationId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const targetX = mousePos.current.x;
      const targetY = mousePos.current.y;

      // 1. Smoothly follow the mouse with no clamp limits across the whole screen
      setGlassPos((prev) => {
        const nx = prev.x + (targetX - prev.x) * 0.25;
        const ny = prev.y + (targetY - prev.y) * 0.25;
        return { x: nx, y: ny };
      });

      // 2. Bird follows slightly behind the mouse
      const bird = birdState.current;
      const desiredBirdX = targetX + (targetX > bird.x ? -90 : 90);
      const desiredBirdY = targetY + 30;

      const dx = desiredBirdX - bird.x;
      const dy = desiredBirdY - bird.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        bird.isMoving = true;
        const speed = Math.min(dist * 3.5, 340); // px/sec
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        bird.x += vx * dt;
        bird.y += vy * dt;
        bird.facing = targetX >= bird.x ? 1 : -1;
        bird.stepPhase += dt * (speed / 18);

        // Footprint drop while walking
        lastFootstepDist.current += speed * dt;
        if (lastFootstepDist.current > 42) {
          lastFootstepDist.current = 0;
          footstepCounter.current += 1;
          const side = footstepCounter.current % 2 === 0 ? 1 : -1;
          const angle = Math.atan2(vy, vx);
          setFootprints((prev) => {
            const next = [
              ...prev.slice(-18),
              {
                id: Date.now() + Math.random(),
                x: bird.x,
                y: bird.y + 26,
                angle,
                side,
              },
            ];
            return next;
          });
        }
      } else {
        bird.isMoving = false;
        bird.stepPhase = 0;
      }

      setBirdPos({
        x: bird.x,
        y: bird.y,
        facing: bird.facing,
        walking: bird.isMoving,
      });

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Compute leg swinging angles based on stepPhase
  const legSwing = Math.sin(birdState.current.stepPhase) * 28;
  const bobbing = birdPos.walking ? Math.abs(Math.sin(birdState.current.stepPhase * 2)) * 5 : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-[#040718] select-none cursor-default"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 30%, rgba(12, 22, 54, 0.6) 0%, rgba(4, 7, 24, 0.98) 85%),
          radial-gradient(ellipse at 80% 80%, rgba(56, 189, 248, 0.05) 0%, transparent 60%)
        `,
      }}
    >
      {/* Detective Footprints on the ground */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {footprints.map((fp) => (
          <div
            key={fp.id}
            className="absolute h-3 w-2 rounded-full opacity-30 transition-opacity duration-1000"
            style={{
              left: `${fp.x}px`,
              top: `${fp.y}px`,
              background: "#38bdf8",
              boxShadow: "0 0 8px rgba(56, 189, 248, 0.6)",
              transform: `translate(-50%, -50%) rotate(${fp.angle}rad) translate(${fp.side * 6}px, 0)`,
            }}
          />
        ))}
      </div>

      {/* Main Glassmorphism Centerpiece */}
      <div className="relative z-10 mx-4 max-w-lg w-full rounded-3xl border border-sky-500/20 bg-[#0d1630]/80 p-8 sm:p-10 text-center shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_35px_rgba(56,189,248,0.15)] backdrop-blur-2xl">
        {/* Status Pill */}
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-[11px] font-mono tracking-widest text-sky-300">
          <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
          <span>{badgeText}</span>
        </div>

        {/* Huge Stylized 404 Header */}
        <div className="relative my-2">
          <h1 className="text-7xl sm:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-200 to-sky-500/40 drop-shadow-[0_0_35px_rgba(56,189,248,0.4)]">
            404
          </h1>
          <div className="mt-1 text-sm sm:text-base font-bold tracking-[4px] text-sky-400 uppercase">
            PAGE NOT FOUND
          </div>
        </div>

        {/* Narrative Description */}
        <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-300/90 font-mono">
          {subtitle}
        </p>

        {/* Hidden Clue revealed subtly on floor / card */}
        <div className="mt-4 inline-block rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 font-mono text-[11px] text-slate-400">
          <span className="text-sky-400 font-semibold">CLUE:</span> Move your cursor &bull; The detective bird is searching
        </div>

        {/* Action Button: Back to login / Home */}
        <div className="mt-8">
          <button
            type="button"
            onClick={onBack}
            className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-r from-sky-500/20 to-blue-600/20 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(56,189,248,0.2)] backdrop-blur-md transition-all duration-300 hover:border-sky-400 hover:from-sky-500/30 hover:to-blue-600/30 hover:shadow-[0_0_35px_rgba(56,189,248,0.45)] hover:scale-[1.01] active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="tracking-wide">{backText}</span>
          </button>
        </div>
      </div>

      {/* Walking Detective Bird (Inline SVG, Rigged legs) */}
      <div
        className="pointer-events-none fixed z-20 transition-transform duration-75"
        style={{
          left: `${birdPos.x}px`,
          top: `${birdPos.y - bobbing}px`,
          transform: `translate(-50%, -50%) scaleX(${birdPos.facing})`,
        }}
      >
        <svg
          width="76"
          height="80"
          viewBox="0 0 76 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="filter drop-shadow-[0_10px_16px_rgba(0,0,0,0.6)]"
        >
          {/* Shadow on the floor */}
          <ellipse cx="38" cy="74" rx="22" ry="5" fill="rgba(0,0,0,0.5)" />

          {/* Left Leg (back) */}
          <g style={{ transformOrigin: "32px 58px", transform: `rotate(${-legSwing}deg)` }}>
            <line x1="32" y1="58" x2="30" y2="70" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <line x1="30" y1="70" x2="38" y2="72" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Right Leg (front) */}
          <g style={{ transformOrigin: "42px 58px", transform: `rotate(${legSwing}deg)` }}>
            <line x1="42" y1="58" x2="44" y2="70" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="44" y1="70" x2="52" y2="72" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* Bird Body */}
          <ellipse cx="38" cy="42" rx="20" ry="18" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <ellipse cx="38" cy="45" rx="14" ry="12" fill="#0f172a" />

          {/* Wing / Trenchcoat Fold */}
          <path
            d="M26 36 C24 48, 32 54, 40 48"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Detective Hat (Fedora) */}
          <path
            d="M16 28 C26 26, 50 26, 60 28"
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M24 27 L28 14 C30 10, 46 10, 48 14 L52 27 Z"
            fill="#0f172a"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          {/* Hat Ribbon */}
          <path d="M26 23 L50 23" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Big Detective Eye with Monocle/Gleam */}
          <circle cx="46" cy="34" r="6" fill="#ffffff" />
          <circle cx="48" cy="34" r="3" fill="#0284c7" />
          <circle cx="49" cy="33" r="1.2" fill="#ffffff" />

          {/* Beak */}
          <polygon points="56,36 68,40 56,43" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
        </svg>
      </div>

      {/* Magnifying Glass following smoothly with pointer */}
      <div
        className="pointer-events-none fixed z-30 transition-transform duration-75 ease-out"
        style={{
          left: `${glassPos.x}px`,
          top: `${glassPos.y}px`,
          transform: "translate(-28px, -28px)",
        }}
      >
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="filter drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]"
        >
          {/* Glass Lens (Glassmorphism circle) */}
          <circle
            cx="28"
            cy="28"
            r="20"
            fill="rgba(56, 189, 248, 0.12)"
            stroke="#38bdf8"
            strokeWidth="3.5"
          />
          {/* Inner glass reflection highlight */}
          <path
            d="M16 24 C18 16, 26 12, 34 14"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Handle */}
          <line
            x1="43"
            y1="43"
            x2="64"
            y2="64"
            stroke="#f59e0b"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="43"
            y1="43"
            x2="64"
            y2="64"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
