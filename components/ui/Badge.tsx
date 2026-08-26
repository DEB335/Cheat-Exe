import type { ResellerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Badge({
  tone,
  className,
  children,
}: {
  tone: "green" | "red";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[20px] border px-2 py-[3px] text-[11px] font-bold tracking-[0.5px] uppercase",
        tone === "green"
          ? "border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] text-[#34d399]"
          : "border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.1)] text-[#f87171]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const DOT_TONES = {
  green: "border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.1)] text-[#34d399]",
  red: "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] text-[#f87171]",
  blue: "border-[rgba(96,165,250,0.25)] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]",
} as const;

const DOT_COLORS = {
  green: "bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.9)]",
  red: "bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.9)]",
  blue: "bg-[#60a5fa] shadow-[0_0_6px_rgba(96,165,250,0.9)]",
} as const;

/**
 * Status pill with a leading dot, for the monitoring tables.
 *
 * `whitespace-nowrap` is the point of it: these sit in the narrowest
 * column of a table that also carries three action buttons, and the old
 * markup let a two-word label wrap to three lines inside a 47px pill.
 * The dot is a styled span rather than a literal bullet character so it
 * keeps its size and glow whatever the font does.
 */
export function DotBadge({
  tone,
  className,
  children,
}: {
  tone: keyof typeof DOT_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-max items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[10px] font-bold tracking-[0.5px] whitespace-nowrap uppercase",
        DOT_TONES[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_COLORS[tone])} />
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<ResellerStatus, string> = {
  ACTIVE: "bg-green-glow text-green border-[rgba(16,185,129,0.25)]",
  SUSPENDED: "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.25)]",
  "PENDING APPROVAL": "bg-orange-glow text-orange border-[rgba(245,158,11,0.25)]",
  EXPIRED: "bg-[rgba(148,163,184,0.15)] text-[#94a3b8] border-[rgba(148,163,184,0.3)]",
};

export function StatusBadge({ status }: { status: ResellerStatus }) {
  return (
    <span
      className={cn(
        "rounded-[20px] border px-3 py-1.5 text-[11px] font-extrabold tracking-[0.5px] uppercase",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

/** Neutral package chip used in the key history tables. */
export function PackageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1.5 rounded-md border border-line bg-white/4 px-2.5 py-[5px] text-[11px] font-bold">
      {children}
    </span>
  );
}

/** Glowing crimson outline chip used in the reseller table. */
export function GlowingPackageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="m-0.5 inline-block rounded-full border border-[rgba(230,40,67,0.4)] bg-[rgba(230,40,67,0.03)] px-2.5 py-[3px] text-[9.5px] font-[750] tracking-[0.8px] whitespace-nowrap text-[#ef4444] uppercase shadow-[0_0_6px_rgba(230,40,67,0.1)]">
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: "OWNER" | "RESELLER" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border px-2 py-[3px] text-[10px] font-bold",
        role === "OWNER"
          ? "border-[rgba(230,40,67,0.15)] bg-[rgba(230,40,67,0.1)] text-[#ef4444]"
          : "border-[rgba(59,130,246,0.15)] bg-[rgba(59,130,246,0.1)] text-[#60a5fa]",
      )}
    >
      {role}
    </span>
  );
}
