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
