import { CalendarIcon, ClockIcon, GlobeIcon, KeyIcon } from "@/components/icons";
import {
  CubeIcon,
  FingerprintIcon,
  IconTile,
  PackageIcon,
  StatusPill,
  packageTone,
  type NeonTone,
} from "@/components/neon";
import { cn } from "@/lib/utils";

export interface KeyInfo {
  key: string;
  appName: string;
  packageName: string;
  status: string;
  createdAt: string;
  expiryDate: string;
  hwid: string;
  ip: string;
  durationDays: number;
}

/**
 * What /api/keys/info returned for the looked-up key: the key and its
 * status on top, then one lit row per field. Every value is printed as
 * the API sent it; only the "Not Bound" / "None" fallbacks are ours.
 */
export function KeyInfoPanel({ info }: { info: KeyInfo }) {
  const active = info.status?.toLowerCase() === "active";
  const bound = info.hwid && info.hwid !== "Not Bound";

  return (
    <div className="mt-6 border-t border-[rgba(139,92,246,0.22)] pt-5 lt:border-slate-200">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <KeyIcon
          aria-hidden
          className="size-5 shrink-0 text-[#6ef3a5] drop-shadow-[0_0_5px_rgba(16,185,129,0.32)] lt:text-emerald-600 lt:drop-shadow-none"
        />
        <span className="min-w-0 font-mono text-[15px] font-semibold break-all text-[#6ef3a5] lt:text-emerald-700">
          {info.key}
        </span>
        <StatusPill status={active ? "success" : "danger"} caps>
          {info.status}
        </StatusPill>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <Detail
          label="Package"
          tone={packageTone(info.packageName ?? "")}
          icon={<PackageIcon name={info.packageName ?? ""} />}
          value={info.packageName}
        />
        <Detail label="Application" tone="violet" icon={<CubeIcon />} value={info.appName} />
        <Detail label="Created" tone="blue" icon={<CalendarIcon />} value={info.createdAt} />
        <Detail label="Expiry" tone="cyan" icon={<ClockIcon />} value={info.expiryDate} />
        <Detail
          label="HWID"
          tone="teal"
          icon={<FingerprintIcon />}
          value={bound ? info.hwid : "Not Bound"}
          muted={!bound}
          mono={Boolean(bound)}
        />
        <Detail
          label="IP"
          tone="blue"
          icon={<GlobeIcon />}
          value={info.ip || "None"}
          muted={!info.ip || info.ip === "None"}
          mono={Boolean(info.ip) && info.ip !== "None"}
        />
      </div>
    </div>
  );
}

function Detail({
  label,
  tone,
  icon,
  value,
  muted,
  mono,
}: {
  label: string;
  tone: NeonTone;
  icon: React.ReactNode;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-[rgba(110,118,245,0.28)] bg-[rgba(6,9,32,0.6)] px-3.5 py-3 lt:border-slate-200 lt:bg-white/70">
      <IconTile tone={tone} variant="glass" size="xs">
        {icon}
      </IconTile>
      <div className="min-w-0">
        <div className="mb-0.5 text-[10.5px] font-extrabold tracking-[1px] text-[#8f9cc8] uppercase lt:text-slate-500">
          {label}
        </div>
        <div
          className={cn(
            "text-[13.5px] font-semibold break-all",
            muted ? "text-muted" : "text-fg",
            mono && "font-mono",
          )}
        >
          {value || "—"}
        </div>
      </div>
    </div>
  );
}
