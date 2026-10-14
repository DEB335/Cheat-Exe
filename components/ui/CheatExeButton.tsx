"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export interface CheatExeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "danger" | "secondary" | "primary" | "warning";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function CheatExeButton({
  variant = "secondary",
  size = "md",
  children,
  icon,
  className,
  disabled,
  ...props
}: CheatExeButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const handlePointerEnter = () => {
    if (disabled) return;
    if (btnRef.current) {
      btnRef.current.style.transition = "transform 0.06s ease-out, box-shadow 0.15s ease-out";
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Interactive 3D perspective tilt
    const rotX = (0.5 - y) * 26;
    const rotY = (x - 0.5) * 26;

    btn.style.transform = `perspective(500px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.04, 1.04, 1.04)`;

    if (glareRef.current) {
      glareRef.current.style.opacity = "1";
      glareRef.current.style.background = `radial-gradient(circle 90px at ${Math.round(x * 100)}% ${Math.round(y * 100)}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.12) 40%, transparent 70%)`;
    }
  };

  const handlePointerLeave = () => {
    const btn = btnRef.current;
    if (!btn) return;
    btn.style.transition = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease";
    btn.style.transform = "perspective(500px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    if (glareRef.current) {
      glareRef.current.style.opacity = "0";
    }
  };

  const sizeClasses = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2.5 text-xs sm:text-sm",
    lg: "px-8 py-3.5 text-sm sm:text-base",
  }[size];

  const variantClasses = {
    secondary: "border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.16] hover:border-white/40 shadow-[0_8px_25px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.65),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    danger: "border border-red-500/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(239,68,68,0.35),rgba(239,68,68,0.12)_70%),#16080e] text-white hover:border-red-400 hover:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(239,68,68,0.5),rgba(239,68,68,0.2)_70%),#200a12] shadow-[0_8px_30px_rgba(239,68,68,0.35),inset_0_1px_2px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_45px_rgba(239,68,68,0.55),inset_0_1px_3px_rgba(255,255,255,0.4)]",
    primary: "border border-sky-400/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(56,189,248,0.35),rgba(56,189,248,0.12)_70%),#07152a] text-white hover:border-sky-300 hover:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(56,189,248,0.5),rgba(56,189,248,0.2)_70%),#0a1e3b] shadow-[0_8px_30px_rgba(56,189,248,0.35),inset_0_1px_2px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_45px_rgba(56,189,248,0.55),inset_0_1px_3px_rgba(255,255,255,0.4)]",
    warning: "border border-amber-500/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(245,158,11,0.35),rgba(245,158,11,0.12)_70%),#1c1305] text-white hover:border-amber-400 hover:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(245,158,11,0.5),rgba(245,158,11,0.2)_70%),#281a07] shadow-[0_8px_30px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_45px_rgba(245,158,11,0.55),inset_0_1px_3px_rgba(255,255,255,0.4)]",
  }[variant];

  return (
    <button
      ref={btnRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      disabled={disabled}
      className={cn(
        "cheatexe-btn",
        sizeClasses,
        variantClasses,
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      {...props}
    >
      <div ref={glareRef} className="cheatexe-btn-glare" />
      {icon && <span className="relative z-10 shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
