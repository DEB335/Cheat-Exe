"use client";

import { useEffect, useRef } from "react";
import { pageZoom } from "@/lib/zoom";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

/** Pure bright fiery red, crimson, and ruby palette for mouse cursor trail */
const PALETTE = [
  "rgba(255, 0, 55, ",
  "rgba(255, 45, 90, ",
  "rgba(255, 80, 110, ",
  "rgba(230, 0, 50, ",
  "rgba(255, 120, 140, ",
];

export function CursorSparks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
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
    window.addEventListener("resize", fit);

    const sparks: Spark[] = [];

    const addSpark = (clientX: number, clientY: number, count = 2) => {
      const x = clientX / zoom;
      const y = clientY / zoom;
      for (let i = 0; i < count; i++) {
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          color,
          size: Math.random() * 2.5 + 1.5,
          life: 0,
          maxLife: Math.random() * 20 + 20,
        });
      }
      if (sparks.length > 50) sparks.splice(0, sparks.length - 50);
    };

    const onPointerMove = (e: MouseEvent) => {
      addSpark(e.clientX, e.clientY, 2);
    };

    const onClick = (e: MouseEvent) => {
      addSpark(e.clientX, e.clientY, 8);
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04; // subtle gravity

        const alpha = Math.max(0, 1 - s.life / s.maxLife);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (1 - (s.life / s.maxLife) * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `${s.color}${alpha})`;
        ctx.shadowColor = "rgba(255, 0, 55, 0.8)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    />
  );
}

