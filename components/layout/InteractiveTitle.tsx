"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InteractiveTitleProps {
  title: string;
  className?: string;
  as?: "h1" | "div" | "span" | "h2";
}

/**
 * Exact Blazexiters "CHEATS" spotlight effect:
 * - Crisp silver-white text by default (#ffffff).
 * - Focused tight red spotlight (radius ~38px):
 *   When the mouse is directly over 'w' or 'e', ONLY that letter and its immediate adjacent
 *   neighbor get bathed in intense crimson glow (#ff0038 / #ff2a55), while the rest of
 *   the word stays crisp white!
 * - As the cursor moves across the word, the red glow slides precisely with the cursor.
 */
export function InteractiveTitle({ title, className, as: Component = "h1" }: InteractiveTitleProps) {
  const headingRef = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const updatePos = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!headingRef.current) return;
    const rect = headingRef.current.getBoundingClientRect();
    // Normalize coordinates strictly within the element's rendered box
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPos({ x, y, active: true });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPos((prev) => ({ ...prev, active: false }));
  }, []);

  return (
    <Component
      ref={headingRef as any}
      onMouseMove={updatePos}
      onMouseEnter={updatePos}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative inline-block font-display font-black tracking-tight cursor-default select-none",
        "text-[22px] sm:text-[25px] lg:text-[28px] leading-[1.1]",
        className,
      )}
    >
      {/* Base crisp silver-white text */}
      <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
        {title}
      </span>

      {/* Tightly focused interactive red glow that tracks the exact cursor position */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none transition-opacity duration-150"
        style={{
          opacity: pos.active ? 1 : 0,
          backgroundImage: pos.active
            ? `radial-gradient(circle 38px at ${pos.x}px ${pos.y}px, #ff0038 0%, #ff204e 45%, #ff4d6d 70%, transparent 100%)`
            : "none",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter:
            "drop-shadow(0 0 10px rgba(255, 0, 56, 0.9)) drop-shadow(0 0 20px rgba(255, 0, 56, 0.6))",
        }}
      >
        {title}
      </span>
    </Component>
  );
}



