import { WrenchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface MaintenanceNoticeProps {
  title?: string;
  description?: string;
  reason?: string | null;
  serviceName?: string;
  tone?: "orange" | "pink" | "purple" | "cyan";
  icon?: React.ReactNode;
  compact?: boolean;
}

/**
 * Shown in place of a section or inside an overview when the service behind it
 * is undergoing maintenance or paused for updates.
 */
export function MaintenanceNotice({
  title = "UID Bypass is under maintenance",
  description = "The UID whitelist service is not available right now. Adding, extending and removing UIDs are all paused until it is back. Nothing you have already sold is affected — existing whitelisted UIDs keep working.",
  reason,
  serviceName = "UID Bypass",
  tone = "orange",
  icon,
  compact = false,
}: MaintenanceNoticeProps) {
  const isPink = tone === "pink";
  const isPurple = tone === "purple";
  const isCyan = tone === "cyan";

  const borderColor = isPink
    ? "border-[rgba(236,72,153,0.45)]"
    : isPurple
      ? "border-[rgba(168,85,247,0.45)]"
      : isCyan
        ? "border-[rgba(14,165,233,0.45)]"
        : "border-[rgba(245,158,11,0.45)]";

  const bgBox = isPink
    ? "bg-[rgba(236,72,153,0.04)]"
    : isPurple
      ? "bg-[rgba(168,85,247,0.04)]"
      : isCyan
        ? "bg-[rgba(14,165,233,0.04)]"
        : "bg-[rgba(245,158,11,0.04)]";

  const iconBg = isPink
    ? "bg-[rgba(236,72,153,0.12)] text-[#ec4899]"
    : isPurple
      ? "bg-[rgba(168,85,247,0.12)] text-[#a855f7]"
      : isCyan
        ? "bg-[rgba(14,165,233,0.12)] text-[#0ea5e9]"
        : "bg-[rgba(245,158,11,0.12)] text-orange";

  const titleColor = isPink
    ? "text-[#ec4899]"
    : isPurple
      ? "text-[#a855f7]"
      : isCyan
        ? "text-[#0ea5e9]"
        : "text-orange";

  const pillBorder = isPink
    ? "border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.1)] text-[#ec4899]"
    : isPurple
      ? "border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.1)] text-[#a855f7]"
      : isCyan
        ? "border-[rgba(14,165,233,0.3)] bg-[rgba(14,165,233,0.1)] text-[#0ea5e9]"
        : "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] text-orange";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl text-center border-2 border-dashed transition-all",
        borderColor,
        bgBox,
        compact ? "px-5 py-8 sm:py-12" : "px-6 py-12 sm:py-16",
      )}
    >
      <div className={cn("mb-5 flex size-14 items-center justify-center rounded-2xl", iconBg)}>
        {icon ?? <WrenchIcon className="size-7" />}
      </div>

      <h2
        className={cn(
          "font-display leading-[1.15] font-extrabold tracking-tight uppercase",
          compact ? "text-[clamp(19px,3vw,26px)]" : "text-[clamp(22px,4vw,36px)]",
          titleColor,
        )}
      >
        {title}
      </h2>

      <p className="mt-3.5 max-w-[480px] text-[13px] leading-relaxed text-muted">
        {description}
      </p>

      <span
        className={cn(
          "mt-6 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[11.5px] font-bold tracking-[0.5px] uppercase",
          pillBorder,
        )}
      >
        <WrenchIcon className="size-3.5" strokeWidth={2.5} />
        {serviceName}: under maintenance
      </span>

      {reason && (
        <p className="mt-5 max-w-[560px] font-mono text-[11px] leading-relaxed break-words text-muted/60">
          {reason}
        </p>
      )}
    </div>
  );
}
