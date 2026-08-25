"use client";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Primary action button: blue outer glow wrapping a dark inner slab.
   Used for GENERATE KEYS, CREATE USER and Save Changes.
   ------------------------------------------------------------------ */
interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  innerClassName?: string;
}

export function PrimaryButton({
  children,
  className,
  innerClassName,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "group relative flex h-[52px] w-full max-w-[320px] cursor-pointer items-center justify-center",
        "rounded-[15px] border-none p-[2.5px] transition-all duration-300 select-none",
        "bg-[image:linear-gradient(to_bottom_right,#2e8eff_0%,rgba(46,142,255,0)_30%)]",
        "bg-[color:rgba(46,142,255,0.65)] shadow-[0_0_15px_rgba(46,142,255,0.45)]",
        "hover:bg-[color:rgba(46,142,255,0.85)] hover:shadow-[0_0_25px_rgba(46,142,255,0.65)] hover:scale-[1.02]",
        "focus:bg-[color:rgba(46,142,255,0.85)] focus:shadow-[0_0_25px_rgba(46,142,255,0.65)] focus:outline-none",
        "active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center gap-3 rounded-[13px] bg-[#161726]",
          "font-display text-[12.5px] font-extrabold tracking-[2px] text-white transition-colors duration-200",
          "group-hover:bg-[#1a1a2e]",
          innerClassName,
        )}
      >
        {children}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------
   Small dark pill with a radial flash on hover ("Copy All", "Refresh").
   ------------------------------------------------------------------ */
export function CopyButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "relative inline-flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden",
        "rounded-[20px] border-[1.5px] border-white/8 bg-[#11121d] px-4 py-1.5",
        "text-[11.5px] font-extrabold tracking-[0.5px] text-white select-none",
        "transition-all duration-[400ms] ease-smooth outline-none",
        "hover:border-white/25 hover:bg-[#1a1a2e] hover:shadow-[0_4px_12px_rgba(255,255,255,0.05)]",
        "active:scale-[0.96]",
        "after:absolute after:inset-0 after:scale-0 after:transition-transform after:duration-500 after:content-['']",
        "after:bg-[radial-gradient(circle,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_70%)]",
        "hover:after:scale-400",
        className,
      )}
    >
      <span className="relative z-[1] inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------
   Neutral bordered button used across the key manager and card headers.
   ------------------------------------------------------------------ */
type ActionTone = "neutral" | "primary" | "success" | "danger";

const ACTION_HOVER: Record<ActionTone, string> = {
  neutral: "hover:bg-white/5 hover:border-white/15",
  primary: "hover:bg-[rgba(59,130,246,0.15)] hover:border-[#3b82f6] hover:text-[#60a5fa] hover:shadow-[0_6px_20px_rgba(59,130,246,0.2)]",
  success: "hover:bg-[rgba(16,185,129,0.15)] hover:border-[#10b981] hover:text-[#34d399] hover:shadow-[0_6px_20px_rgba(16,185,129,0.2)]",
  danger: "hover:bg-[rgba(239,68,68,0.15)] hover:border-[#ef4444] hover:text-[#f87171] hover:shadow-[0_6px_20px_rgba(239,68,68,0.2)]",
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ActionTone;
}

export function ActionButton({
  tone = "neutral",
  children,
  className,
  ...rest
}: ActionButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-line",
        "bg-white/2 p-3.5 text-[13px] font-bold text-fg",
        "transition-all duration-300 ease-smooth hover:-translate-y-0.5",
        ACTION_HOVER[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------
   Compact tinted header buttons ("Refresh History", "Clear Logs").
   ------------------------------------------------------------------ */
interface TintButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone: "green" | "red";
}

export function TintButton({ tone, children, className, ...rest }: TintButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5",
        "text-[12px] font-semibold transition-all duration-300 ease-smooth hover:-translate-y-0.5",
        tone === "green"
          ? "border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)] text-[#10b981] hover:bg-[rgba(16,185,129,0.12)]"
          : "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.18)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------
   Shimmering gradient pills in the reseller table row actions.
   ------------------------------------------------------------------ */
export type PillTone = "suspend" | "activate" | "perms" | "pass" | "delete";

const PILL_TONES: Record<PillTone, string> = {
  suspend:
    "bg-[linear-gradient(135deg,#d97706,#fb923c)] hover:bg-[linear-gradient(135deg,#b45309,#f97316)] hover:shadow-[0_6px_15px_rgba(249,115,22,0.35)]",
  activate:
    "bg-[linear-gradient(135deg,#059669,#34d399)] hover:bg-[linear-gradient(135deg,#047857,#10b981)] hover:shadow-[0_6px_15px_rgba(16,185,129,0.35)]",
  perms:
    "bg-[linear-gradient(135deg,#7c3aed,#c084fc)] hover:bg-[linear-gradient(135deg,#6d28d9,#a855f7)] hover:shadow-[0_6px_15px_rgba(168,85,247,0.35)]",
  pass: "bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)] hover:bg-[linear-gradient(135deg,#1e40af,#3b82f6)] hover:shadow-[0_6px_15px_rgba(59,130,246,0.35)]",
  delete:
    "bg-[linear-gradient(135deg,#b91c1c,#f87171)] hover:bg-[linear-gradient(135deg,#991b1b,#ef4444)] hover:shadow-[0_6px_15px_rgba(239,68,68,0.35)]",
};

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone: PillTone;
}

export function PillButton({ tone, children, className, ...rest }: PillButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "animate-button-shimmer relative inline-flex h-9 w-[90px] cursor-pointer items-center justify-center gap-[5px]",
        "rounded-[18px] border-none text-[11px] font-extrabold text-white",
        "shadow-[0_4px_10px_rgba(0,0,0,0.2)] [background-size:200%_200%]",
        "transition-all duration-300 ease-smooth",
        "hover:-translate-y-0.5 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)]",
        "active:translate-y-0 active:scale-95 active:shadow-[0_2px_5px_rgba(0,0,0,0.2)]",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------
   Tiny table buttons (Kick, Unban).
   ------------------------------------------------------------------ */
interface SmallButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone: "success" | "warning" | "danger";
}

const SMALL_TONES: Record<SmallButtonProps["tone"], string> = {
  success:
    "bg-green-glow text-green border-[rgba(16,185,129,0.2)] hover:bg-[rgba(16,185,129,0.25)] hover:shadow-[0_4px_10px_var(--accent-green-glow)]",
  warning:
    "bg-orange-glow text-orange border-[rgba(245,158,11,0.2)] hover:bg-[rgba(245,158,11,0.25)] hover:shadow-[0_4px_10px_var(--accent-orange-glow)]",
  danger:
    "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.25)] hover:shadow-[0_4px_10px_var(--accent-red-glow)]",
};

export function SmallButton({ tone, children, className, ...rest }: SmallButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5",
        "text-[11px] font-[850] transition-all duration-200 ease-smooth hover:-translate-y-px",
        SMALL_TONES[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Bare icon button used inside the vault password cell. */
export function IconButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "flex cursor-pointer items-center justify-center border-none bg-transparent p-0.5",
        "text-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
