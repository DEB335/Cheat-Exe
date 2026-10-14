"use client";

import React, { useEffect, useRef, useState } from "react";
import { pageZoom } from "@/lib/zoom";

interface Wind404Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backText?: string;
}

interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  size: number;
  opacity: number;
  color: string;
}

export function Wind404({
  title = "404",
  subtitle = "Nothing at this address but the wind.",
  onBack,
  backText = "Back to sign in",
}: Wind404Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 });
  const [lettersLean, setLettersLean] = useState<number[]>([]);
  const headlineLetters = title.split("");

  // Letter lean springs simulation
  const letterAngles = useRef<number[]>(title.split("").map(() => 0));
  const letterVelocities = useRef<number[]>(title.split("").map(() => 0));

  useEffect(() => {
    letterAngles.current = headlineLetters.map(() => 0);
    letterVelocities.current = headlineLetters.map(() => 0);
    setLettersLean(headlineLetters.map(() => 0));
  }, [title]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let zoom = 1;
    let width = 0;
    let height = 0;

    const fit = () => {
      zoom = pageZoom();
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = `${window.innerWidth / zoom}px`;
      canvas.style.height = `${window.innerHeight / zoom}px`;
      ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
      width = window.innerWidth / zoom;
      height = window.innerHeight / zoom;
    };
    fit();

    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fit, 100);
    };
    window.addEventListener("resize", onResize);

    // Track mouse velocity as wind generator
    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const z = pageZoom();
      const mx = e.clientX / z;
      const my = e.clientY / z;

      const prevTime = mouseRef.current.lastTime || now;
      const dt = Math.max(1, now - prevTime);
      const vx = ((mx - (mouseRef.current.lastX || mx)) / dt) * 16;
      const vy = ((my - (mouseRef.current.lastY || my)) / dt) * 16;

      mouseRef.current = {
        x: mx,
        y: my,
        vx,
        vy,
        lastX: mx,
        lastY: my,
        lastTime: now,
      };
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // Leaves palette (autumn amber, gold, neon blue cyan embers)
    const LEAF_COLORS = [
      "rgba(251, 146, 60, ", // Amber orange
      "rgba(245, 158, 11, ", // Gold
      "rgba(56, 189, 248, ", // Cyan breeze ember
      "rgba(234, 88, 12, ",  // Deep autumn
      "rgba(147, 197, 253, ", // Soft sky breeze
    ];

    const leaves: Leaf[] = Array.from({ length: 45 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.random() * 2 + 1.5,
      vy: Math.random() * 1.5 + 0.5,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.08,
      size: Math.random() * 8 + 6,
      opacity: Math.random() * 0.7 + 0.3,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    }));

    // Wind gusts
    let windGust = 1.8;
    let gustTimer = 0;

    let animId: number;
    let lastLoopTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastLoopTime) / 1000, 0.1);
      lastLoopTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      // Natural gust variation
      gustTimer += dt;
      windGust = 2.2 + Math.sin(gustTimer * 1.2) * 1.5 + Math.cos(gustTimer * 2.5) * 0.8;

      // Mouse wind decays
      mouseRef.current.vx *= 0.94;
      mouseRef.current.vy *= 0.94;

      // 1. Draw and update leaves
      for (const leaf of leaves) {
        // Wind influence
        let currentVx = leaf.vx + windGust;
        let currentVy = leaf.vy + Math.sin(leaf.x * 0.01 + gustTimer) * 1.2;

        // Interaction with mouse wind
        const dx = leaf.x - mouseRef.current.x;
        const dy = leaf.y - mouseRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          const force = (1 - dist / 180) * 12;
          currentVx += mouseRef.current.vx * force * 0.2 + (dx / (dist || 1)) * force;
          currentVy += mouseRef.current.vy * force * 0.2 + (dy / (dist || 1)) * force;
          leaf.vAngle += (Math.random() - 0.5) * 0.2;
        }

        leaf.x += currentVx * 60 * dt;
        leaf.y += currentVy * 60 * dt;
        leaf.angle += leaf.vAngle;

        // Wrap edges smoothly
        if (leaf.x > width + 40) {
          leaf.x = -30;
          leaf.y = Math.random() * height;
        }
        if (leaf.y > height + 40) {
          leaf.y = -30;
          leaf.x = Math.random() * width;
        }
        if (leaf.y < -40) {
          leaf.y = height + 30;
        }

        // Draw individual stylized leaf / petal
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.angle);

        ctx.fillStyle = `${leaf.color}${leaf.opacity})`;
        ctx.beginPath();
        // Leaf shape (curved teardrop)
        ctx.moveTo(0, -leaf.size);
        ctx.quadraticCurveTo(leaf.size * 0.7, 0, 0, leaf.size);
        ctx.quadraticCurveTo(-leaf.size * 0.7, 0, 0, -leaf.size);
        ctx.fill();

        // Delicate spine
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -leaf.size * 0.8);
        ctx.lineTo(0, leaf.size * 0.8);
        ctx.stroke();

        ctx.restore();
      }

      // 2. Physics simulation for Headline Letters leaning with wind
      const updatedLeans: number[] = [];
      const k = 14; // spring tension
      const damping = 3.5; // damping

      for (let i = 0; i < letterAngles.current.length; i++) {
        // Natural ambient wind target lean
        let targetAngle = windGust * 2.8 + Math.sin(gustTimer * 2 + i * 0.5) * 3;

        // Cursor wind influence on each letter
        const el = document.getElementById(`wind-letter-${i}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const letterCenterX = (rect.left + rect.width / 2) / zoom;
          const letterCenterY = (rect.top + rect.height / 2) / zoom;

          const distToMouse = Math.hypot(
            mouseRef.current.x - letterCenterX,
            mouseRef.current.y - letterCenterY
          );

          if (distToMouse < 220) {
            const push = (1 - distToMouse / 220) * 28;
            const dir = mouseRef.current.x < letterCenterX ? 1 : -1;
            targetAngle += (mouseRef.current.vx * 0.8 + dir * push);
          }
        }

        // Spring acceleration
        const diff = targetAngle - letterAngles.current[i];
        const accel = diff * k - letterVelocities.current[i] * damping;

        letterVelocities.current[i] += accel * dt;
        letterAngles.current[i] += letterVelocities.current[i] * dt;

        // Clamp angle to realistic organic tilt (-45deg to +50deg)
        letterAngles.current[i] = Math.max(-40, Math.min(50, letterAngles.current[i]));
        updatedLeans.push(letterAngles.current[i]);
      }

      setLettersLean(updatedLeans);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animId);
    };
  }, [headlineLetters.length]);

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-[#050814] select-none"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 35%, rgba(14, 25, 60, 0.85) 0%, rgba(3, 6, 18, 0.98) 85%),
          radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 60%)
        `,
      }}
    >
      {/* Interactive Wind & Falling Leaves Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-10" />

      {/* Main Content Box */}
      <div className="relative z-20 mx-4 max-w-xl w-full text-center px-6 py-10 rounded-3xl border border-white/10 bg-[#0c142e]/70 shadow-[0_0_80px_rgba(0,0,0,0.85),0_0_40px_rgba(56,189,248,0.12)] backdrop-blur-2xl">
        {/* Subtle Wind Badge */}
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-1.5 text-xs font-mono tracking-widest text-sky-300">
          <svg className="h-4 w-4 animate-spin-slow text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>AUTUMN GUST &bull; 404</span>
        </div>

        {/* 404 Headline: Every gust leans the headline letter-by-letter */}
        <div className="flex items-center justify-center gap-2 my-2 py-4">
          {headlineLetters.map((char, idx) => (
            <span
              id={`wind-letter-${idx}`}
              key={idx}
              className="inline-block text-8xl sm:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-100 to-amber-200/50 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] transition-transform duration-75 will-change-transform"
              style={{
                transformOrigin: "bottom center",
                transform: `rotate(${lettersLean[idx] || 0}deg) skewX(${(lettersLean[idx] || 0) * 0.3}deg)`,
              }}
            >
              {char}
            </span>
          ))}
        </div>

        {/* Headline Quote from reel */}
        <h2 className="mt-2 text-lg sm:text-xl font-bold tracking-wide text-slate-100">
          Nothing at this address but the wind. 🍃
        </h2>

        {/* Subtitle description */}
        <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-400 font-mono max-w-md mx-auto">
          {subtitle}
        </p>

        {/* Micro note on cursor wind interaction */}
        <div className="mt-5 inline-block rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 font-mono text-[11px] text-slate-400">
          <span className="text-amber-400 font-semibold">INTERACTIVE:</span> Move cursor to blow wind against the letters and leaves
        </div>

        {/* Back to sign in button */}
        <div className="mt-8">
          <button
            type="button"
            onClick={onBack}
            className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-r from-sky-500/20 via-blue-600/20 to-amber-500/20 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_rgba(56,189,248,0.25)] backdrop-blur-md transition-all duration-300 hover:border-sky-300 hover:shadow-[0_0_40px_rgba(56,189,248,0.45)] hover:scale-[1.01] active:scale-[0.98]"
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
    </div>
  );
}
