"use client";

import { useEffect, useRef } from "react";

import { pageZoom } from "@/lib/zoom";

const MAX_PARTICLES = 30;

/** Gold, crimson, cyan, violet, diamond white. */
const PALETTE = [
  "rgba(251, 191, 36, ",
  "rgba(255, 51, 102, ",
  "rgba(0, 243, 255, ",
  "rgba(168, 85, 247, ",
  "rgba(255, 255, 255, ",
];

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

/**
 * Sparks that trail the cursor and burst on click. Skipped entirely for
 * reduced-motion users and touch-only pointers, as in the original.
 */
export function CursorSparks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // The backing store is the viewport in real screen px, as before. The
    // box is sized here because a canvas with only `inset-0` keeps its
    // intrinsic size, which the page zoom then shrinks to 75% of the
    // screen. Sparks are drawn in the page's zoomed px so they shrink with
    // everything else.
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

    const particles: Spark[] = [];
    let mouseX = -100;
    let mouseY = -100;
    let lastX = -100;
    let lastY = -100;
    let ticking = false;
    let frame = 0;
    let resizeTimer: number | undefined;

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fit, 150);
    };

    const addSpark = (x: number, y: number, vx: number, vy: number, size: number, life: number) => {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({
        x,
        y,
        vx,
        vy,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)]!,
        size,
        life,
        maxLife: life,
      });
    };

    /** Inside the collapsed sidebar the sparks fight the nav glow, so skip. */
    const inCollapsedSidebar = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("aside[data-collapsed='true']"));

    // clientX/Y are real screen px; the context draws in zoomed px.
    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX / zoom;
      mouseY = event.clientY / zoom;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (inCollapsedSidebar(event.target)) {
          ticking = false;
          return;
        }
        if (Math.hypot(mouseX - lastX, mouseY - lastY) > 4) {
          const vx = (mouseX - lastX) * 0.15 + (Math.random() - 0.5) * 0.8;
          const vy = (mouseY - lastY) * 0.15 + (Math.random() - 0.5) * 0.8;
          addSpark(mouseX, mouseY, vx, vy, Math.random() * 2.5 + 1.5, 14);
          lastX = mouseX;
          lastY = mouseY;
        }
        ticking = false;
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (inCollapsedSidebar(event.target)) return;
      for (let i = 0; i < 14; i++) {
        const angle = ((Math.PI * 2) / 14) * i + Math.random() * 0.2;
        const speed = Math.random() * 4 + 1.5;
        addSpark(
          event.clientX / zoom,
          event.clientY / zoom,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          Math.random() * 3.5 + 2,
          Math.floor(Math.random() * 15 + 15),
        );
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      if (particles.length > 0) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]!;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.92;
          p.vy *= 0.92;
          p.life--;

          const alpha = p.life / p.maxLife;
          if (alpha > 0) {
            ctx.fillStyle = `${p.color}${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
          }
          if (p.life <= 0) particles.splice(i, 1);
        }
      }
      frame = requestAnimationFrame(render);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999998]"
    />
  );
}
