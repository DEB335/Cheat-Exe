import { WrenchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface MaintenanceNoticeEngine {
  /** Short engine label, e.g. "V1" or "V2". */
  name: string;
  /** True while the engine is up, false while it is under maintenance. */
  up: boolean;
}

export interface MaintenanceNoticeProps {
  title?: string;
  description?: string;
  reason?: string | null;
  serviceName?: string;
  tone?: "orange" | "pink" | "purple" | "cyan" | "red";
  icon?: React.ReactNode;
  compact?: boolean;
  /**
   * Per-engine state, rendered as one pill per engine. A service that runs
   * more than one engine (Lib Bypass V1 / V2) passes both, so the card
   * always reads which one is down and which one is still up -- the same
   * verdict the emulator page shows, never a single blanket flag.
   */
  engines?: MaintenanceNoticeEngine[];
}

/** The accent colour per tone, as raw RGB so it can be woven into rgba(). */
const ACCENT: Record<NonNullable<MaintenanceNoticeProps["tone"]>, string> = {
  red: "255,45,90",
  pink: "236,72,153",
  purple: "168,85,247",
  cyan: "14,165,233",
  orange: "245,158,11",
};

/**
 * Shown in place of a section or inside an overview when the service behind it
 * is undergoing maintenance or paused for updates.
 *
 * The colour lives in the border, the icon tile and the pill only -- every
 * line of text is white or near-white. A tinted heading (which is what
 * this used to be) reads as decoration on a dark panel and, in the pink
 * tone, as a warning about the warning; white text is quieter and
 * legible against the bright backdrop video.
 */
export function MaintenanceNotice({
  title = "UID Bypass is under maintenance",
  description = "The UID whitelist service is not available right now. Adding, extending and removing UIDs are all paused until it is back. Nothing you have already sold is affected — existing whitelisted UIDs keep working.",
  reason,
  serviceName = "UID Bypass",
  tone = "orange",
  icon,
  compact = false,
  engines,
}: MaintenanceNoticeProps) {
  const accent = ACCENT[tone] ?? ACCENT.orange;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl text-center border-2 border-dashed transition-all",
        compact ? "px-5 py-8 sm:py-12" : "px-6 py-12 sm:py-16",
      )}
      style={{
        borderColor: `rgba(${accent},0.45)`,
        backgroundColor: `rgba(${accent},0.05)`,
      }}
    >
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `rgba(${accent},0.16)`, color: `rgb(${accent})` }}
      >
        {icon ?? <WrenchIcon className="size-7" />}
      </div>

      <h2
        className={cn(
          "font-display leading-[1.15] font-extrabold tracking-tight text-white uppercase",
          compact ? "text-[clamp(19px,3vw,26px)]" : "text-[clamp(22px,4vw,36px)]",
        )}
      >
        {title}
      </h2>

      <p className="mt-3.5 max-w-[480px] text-[13px] leading-relaxed text-[#e6ecf7]">
        {description}
      </p>

      {engines && engines.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {engines.map((engine) => (
            <span
              key={engine.name}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase",
                engine.up
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-red-500/40 bg-red-500/15",
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: engine.up ? "#34d399" : "#f87171" }}
              />
              <span>{engine.name}:</span>
              <span>{engine.up ? "Online" : "In Maintenance"}</span>
            </span>
          ))}
        </div>
      )}

      <span
        className="mt-6 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[11.5px] font-bold tracking-[0.5px] text-white uppercase"
        style={{
          borderColor: `rgba(${accent},0.45)`,
          backgroundColor: `rgba(${accent},0.16)`,
        }}
      >
        <WrenchIcon className="size-3.5" strokeWidth={2.5} />
        {serviceName}: under maintenance
      </span>

      {reason && (
        <p className="mt-5 max-w-[560px] font-mono text-[11px] leading-relaxed break-words text-[#cbd5e1]">
          {reason}
        </p>
      )}
    </div>
  );
}
