import { useId } from "react";

import type { BrowserKind, OsKind } from "@/lib/device-parse";
import { cn } from "@/lib/utils";

/**
 * OS and browser marks for the live devices table: simplified, drawn
 * here rather than pulled from an icon set, in each vendor's colours.
 *
 * Every fill is a top-lit gradient, which is what gives the marks their
 * glossy, slightly raised look. The stop colours are set as attributes
 * for the dark theme and overridden by `lt:` classes, because a pale
 * cyan or white that glows on navy glass vanishes on a white card.
 */

type MarkProps = { className?: string };

/** Gradient ids must be unique per instance: a row renders two marks, the table ten rows. */
function useUid() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

function Mark({
  className,
  glow,
  children,
}: {
  className?: string;
  glow: string;
  children: React.ReactNode;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn("size-4 shrink-0", glow, className)}>
      {children}
    </svg>
  );
}

/** A vertical two-stop gradient, light on top. */
function Lit({
  id,
  top,
  bottom,
  ltTop,
  ltBottom,
}: {
  id: string;
  top: string;
  bottom: string;
  ltTop?: string;
  ltBottom?: string;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={top} className={ltTop} />
      <stop offset="1" stopColor={bottom} className={ltBottom} />
    </linearGradient>
  );
}

/** White sheen over the upper half of a round mark. */
function Gloss({ id, cx = 12, cy = 8.5, rx = 7, ry = 4.6 }: { id: string; cx?: number; cy?: number; rx?: number; ry?: number }) {
  return (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </>
  );
}

// --- Operating systems -------------------------------------------------

function WindowsMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(34,211,238,0.65)] lt:drop-shadow-[0_1px_1px_rgba(2,132,199,0.3)]"
    >
      <defs>
        <Lit
          id={`${id}w`}
          top="#a5f3fc"
          bottom="#0ea5e9"
          ltTop="lt:[stop-color:#38bdf8]"
          ltBottom="lt:[stop-color:#0369a1]"
        />
      </defs>
      {/* The four panes in perspective, taller on the right. */}
      <g fill={`url(#${id}w)`}>
        <path d="M2.5 5.2 10.4 4.1v7.4H2.5z" />
        <path d="M11.5 3.9 21.5 2.5v9H11.5z" />
        <path d="M2.5 12.5h7.9v7.4l-7.9-1.1z" />
        <path d="M11.5 12.5h10v9l-10-1.4z" />
      </g>
    </Mark>
  );
}

function AndroidMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(74,222,128,0.6)] lt:drop-shadow-[0_1px_1px_rgba(21,128,61,0.3)]"
    >
      <defs>
        <Lit
          id={`${id}a`}
          top="#bbf7d0"
          bottom="#22c55e"
          ltTop="lt:[stop-color:#4ade80]"
          ltBottom="lt:[stop-color:#15803d]"
        />
      </defs>
      <g fill={`url(#${id}a)`}>
        <path d="M6.3 9.6a5.7 5.7 0 0 1 11.4 0z" />
        <rect x="6.3" y="10.4" width="11.4" height="7.8" rx="1.4" />
        <rect x="3.4" y="10.6" width="2.1" height="6.2" rx="1.05" />
        <rect x="18.5" y="10.6" width="2.1" height="6.2" rx="1.05" />
        <rect x="8.6" y="16.8" width="2.1" height="4.2" rx="1.05" />
        <rect x="13.3" y="16.8" width="2.1" height="4.2" rx="1.05" />
      </g>
      <g stroke={`url(#${id}a)`} strokeWidth="1.1" strokeLinecap="round">
        <line x1="8.7" y1="5.4" x2="7.5" y2="3.4" />
        <line x1="15.3" y1="5.4" x2="16.5" y2="3.4" />
      </g>
      <circle cx="9.9" cy="7.5" r="0.75" fill="#052e16" />
      <circle cx="14.1" cy="7.5" r="0.75" fill="#052e16" />
    </Mark>
  );
}

function AppleMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(226,232,240,0.55)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.3)]"
    >
      <defs>
        <Lit
          id={`${id}p`}
          top="#ffffff"
          bottom="#94a3b8"
          ltTop="lt:[stop-color:#64748b]"
          ltBottom="lt:[stop-color:#0f172a]"
        />
      </defs>
      <g fill={`url(#${id}p)`}>
        {/* Body, with the bite taken out of the right-hand side. */}
        <path d="M12 7.4c-1.3-.9-3-1.2-4.5-.5C5 8.1 4.2 11.3 5.1 14.3c.8 2.9 2.7 6.1 4.7 6.2 1 0 1.4-.6 2.2-.6s1.2.6 2.2.6c2-.1 3.4-2.6 4.3-4.9-1.6-.7-2.6-2.1-2.6-3.8 0-1.4.7-2.7 1.9-3.4-.9-1.4-2.4-2.1-3.9-2-.8 0-1.3.3-1.9.5z" />
        <path d="M12.2 6.3c0-1.7 1.3-3.2 3-3.4.1 1.7-1.2 3.3-3 3.4z" />
      </g>
    </Mark>
  );
}

function LinuxMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(251,191,36,0.45)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.3)]"
    >
      <defs>
        {/* Tux is black; on navy that disappears, so he is lit slate. */}
        <Lit
          id={`${id}t`}
          top="#94a3b8"
          bottom="#1e293b"
          ltTop="lt:[stop-color:#475569]"
          ltBottom="lt:[stop-color:#020617]"
        />
        <Lit id={`${id}o`} top="#fde68a" bottom="#f59e0b" />
      </defs>
      <ellipse cx="12" cy="12.6" rx="6.2" ry="8.4" fill={`url(#${id}t)`} />
      <ellipse cx="12" cy="15" rx="3.9" ry="5" fill="#f8fafc" />
      <circle cx="10.4" cy="8" r="1.15" fill="#f8fafc" />
      <circle cx="13.6" cy="8" r="1.15" fill="#f8fafc" />
      <circle cx="10.6" cy="8.2" r="0.5" fill="#0f172a" />
      <circle cx="13.4" cy="8.2" r="0.5" fill="#0f172a" />
      <path d="M10.6 10.2h2.8L12 11.9z" fill={`url(#${id}o)`} />
      <ellipse cx="8.6" cy="20.9" rx="2.4" ry="1.1" fill={`url(#${id}o)`} />
      <ellipse cx="15.4" cy="20.9" rx="2.4" ry="1.1" fill={`url(#${id}o)`} />
    </Mark>
  );
}

function UnixMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(74,222,128,0.45)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.3)]"
    >
      <defs>
        <Lit
          id={`${id}u`}
          top="#475569"
          bottom="#0f172a"
          ltTop="lt:[stop-color:#334155]"
          ltBottom="lt:[stop-color:#020617]"
        />
      </defs>
      <rect x="2.5" y="4" width="19" height="16" rx="3" fill={`url(#${id}u)`} stroke="#64748b" strokeWidth="0.8" />
      <path d="m6.5 9 3 3-3 3" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="11.5" y1="15.5" x2="17" y2="15.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
    </Mark>
  );
}

function UnknownOsMark({ className }: MarkProps) {
  return (
    <Mark className={className} glow="drop-shadow-[0_0_2px_rgba(148,163,184,0.45)] lt:drop-shadow-none">
      <g
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-slate-300 lt:stroke-slate-500"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </g>
    </Mark>
  );
}

// --- Browsers ----------------------------------------------------------

function ChromeMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(250,204,21,0.4)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
    >
      <defs>
        <Lit id={`${id}r`} top="#f87171" bottom="#dc2626" />
        <Lit id={`${id}y`} top="#fde047" bottom="#eab308" />
        <Lit id={`${id}g`} top="#4ade80" bottom="#16a34a" />
        <Lit id={`${id}b`} top="#93c5fd" bottom="#2563eb" />
      </defs>
      {/* Three 120-degree sectors: red over the top, yellow right, green left. */}
      <path d="M12 12 3.34 7A10 10 0 0 1 20.66 7z" fill={`url(#${id}r)`} />
      <path d="M12 12 20.66 7A10 10 0 0 1 12 22z" fill={`url(#${id}y)`} />
      <path d="M12 12 12 22A10 10 0 0 1 3.34 7z" fill={`url(#${id}g)`} />
      <circle cx="12" cy="12" r="4.9" fill="#fff" />
      <circle cx="12" cy="12" r="3.8" fill={`url(#${id}b)`} />
      <Gloss id={`${id}s`} cy={7.6} rx={7.4} ry={4.2} />
    </Mark>
  );
}

function EdgeMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(45,212,191,0.55)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
    >
      <defs>
        <linearGradient id={`${id}t`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <Lit id={`${id}b`} top="#38bdf8" bottom="#1d4ed8" />
      </defs>
      {/* The top swoosh curling into its hook ... */}
      <path
        d="M3 12C3 6.5 7.2 3 12.3 3 17.4 3 21 6.6 21 11.4c0 3-2.2 4.8-5 4.8-2 0-3.2-.8-3.2-.8 1.8-.4 3-1.8 3-3.6 0-2.4-2-4.2-4.8-4.2C6.6 7.6 3 10.4 3 12z"
        fill={`url(#${id}t)`}
      />
      {/* ... and the wave that closes the circle underneath. */}
      <path
        d="M3 12c0 5 4 9 9 9 2.8 0 5.2-1.2 6.8-3-1.2.6-2.6.9-4 .9-4.4 0-7.6-3.1-7.6-6.5 0-1.8 1-3.4 2.2-4.4C5.8 8.8 3 10.8 3 12z"
        fill={`url(#${id}b)`}
      />
    </Mark>
  );
}

function FirefoxMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(251,146,60,0.55)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="0.45" stopColor="#f97316" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <Lit id={`${id}p`} top="#c4b5fd" bottom="#6d28d9" />
        {/* The fox is the ring left when the globe's circle is cut out of a larger one. */}
        <mask id={`${id}m`}>
          <rect width="24" height="24" fill="#fff" />
          <circle cx="10.6" cy="11.2" r="6.6" fill="#000" />
        </mask>
      </defs>
      <circle cx="10.6" cy="11.2" r="6.3" fill={`url(#${id}p)`} />
      <circle cx="12" cy="12" r="9.6" fill={`url(#${id}f)`} mask={`url(#${id}m)`} />
      {/* The tail flicking over the top of the globe. */}
      <path d="M4.2 5.6c.4 2 1.6 3.2 3 3.5-.3-1.5.3-3 1.6-3.9-1.6-.1-3.1.1-4.6.4z" fill={`url(#${id}f)`} />
      <Gloss id={`${id}s`} cx={10.6} cy={8} rx={4.6} ry={2.8} />
    </Mark>
  );
}

function SafariMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(56,189,248,0.6)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
    >
      <defs>
        <Lit id={`${id}c`} top="#7dd3fc" bottom="#1d4ed8" />
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${id}c)`} />
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.7" />
      <g stroke="#fff" strokeOpacity="0.8" strokeWidth="1" strokeLinecap="round">
        <line x1="12" y1="4.4" x2="12" y2="5.8" />
        <line x1="12" y1="18.2" x2="12" y2="19.6" />
        <line x1="4.4" y1="12" x2="5.8" y2="12" />
        <line x1="18.2" y1="12" x2="19.6" y2="12" />
      </g>
      {/* The needle, north-east half red. */}
      <path d="M17 7 13.13 13.13 10.87 10.87z" fill="#ef4444" />
      <path d="M7 17 10.87 10.87 13.13 13.13z" fill="#f8fafc" />
      <Gloss id={`${id}s`} cy={7.4} rx={7.2} ry={4} />
    </Mark>
  );
}

function IeMark({ className }: MarkProps) {
  const id = useUid();
  return (
    <Mark
      className={className}
      glow="drop-shadow-[0_0_3px_rgba(56,189,248,0.55)] lt:drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
    >
      <defs>
        <Lit id={`${id}e`} top="#7dd3fc" bottom="#0369a1" />
      </defs>
      <path
        fillRule="evenodd"
        fill={`url(#${id}e)`}
        d="M17.6 13H8.6c.3 2.2 1.8 3.6 4 3.6 1.4 0 2.6-.6 3.4-1.6l1.3 1.6c-1.2 1.4-2.9 2.2-4.9 2.2-3.5 0-6-2.6-6-6.2S8.9 6.4 12.3 6.4c3.2 0 5.3 2.4 5.3 5.8zM8.7 11.2h6.6c-.2-1.6-1.4-2.7-3.1-2.7-1.8 0-3.1 1.1-3.5 2.7z"
      />
      <ellipse
        cx="12"
        cy="12.4"
        rx="10.5"
        ry="4"
        transform="rotate(-28 12 12.4)"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.3"
      />
    </Mark>
  );
}

function UnknownBrowserMark({ className }: MarkProps) {
  return (
    <Mark className={className} glow="drop-shadow-[0_0_2px_rgba(148,163,184,0.45)] lt:drop-shadow-none">
      <g
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-slate-300 lt:stroke-slate-500"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </g>
    </Mark>
  );
}

const OS_MARKS: Record<OsKind, (p: MarkProps) => React.ReactElement> = {
  windows: WindowsMark,
  android: AndroidMark,
  ios: AppleMark,
  macos: AppleMark,
  linux: LinuxMark,
  unix: UnixMark,
  unknown: UnknownOsMark,
};

const BROWSER_MARKS: Record<BrowserKind, (p: MarkProps) => React.ReactElement> = {
  chrome: ChromeMark,
  edge: EdgeMark,
  firefox: FirefoxMark,
  safari: SafariMark,
  ie: IeMark,
  unknown: UnknownBrowserMark,
};

export function OsIcon({ os, className }: { os: OsKind; className?: string }) {
  const Icon = OS_MARKS[os] ?? UnknownOsMark;
  return <Icon className={className} />;
}

export function BrowserIcon({ browser, className }: { browser: BrowserKind; className?: string }) {
  const Icon = BROWSER_MARKS[browser] ?? UnknownBrowserMark;
  return <Icon className={className} />;
}
