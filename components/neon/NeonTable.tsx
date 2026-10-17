"use client";

import { Children, useRef } from "react";

import { cn } from "@/lib/utils";

import { IconTile } from "./IconTile";
import { toneVars, type NeonTone } from "./tones";
import { useScrolling } from "./use-scrolling";

export type NeonAlign = "left" | "center" | "right";

export type NeonColumn =
  | string
  | {
      label: React.ReactNode;
      align?: NeonAlign;
      /** Classes for the header cell, e.g. a width or `max-lg:hidden`. */
      className?: string;
      /** Stable key when the label is not a string. */
      key?: string;
    };

const ALIGN: Record<NeonAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * The neon glass table: a rounded, rim-lit container, a header strip
 * with a band of light that crosses it now and then, and rows that tip
 * in on arrival and light up with a glowing rim under the pointer.
 *
 * Phones scroll it sideways inside its own container (set `minWidth`),
 * so the page never scrolls horizontally. Rows are the caller's
 * <NeonRow>s; with none, `empty` is shown across the full width.
 */
export function NeonTable({
  columns,
  minWidth = 760,
  empty,
  tone = "red",
  className,
  tableClassName,
  children,
}: {
  columns: NeonColumn[];
  /** Below this width (CSS px) the table scrolls inside its container. */
  minWidth?: number;
  /** Shown when there are no rows, e.g. <NeonEmpty .../>. */
  empty?: React.ReactNode;
  /** The row hover rim and header light. Default "red". */
  tone?: NeonTone;
  className?: string;
  tableClassName?: string;
  children?: React.ReactNode;
}) {
  const hasRows = Children.toArray(children).length > 0;
  const frame = useRef<HTMLDivElement>(null);
  useScrolling(frame);

  return (
    <div
      ref={frame}
      style={toneVars(tone)}
      className={cn(
        "relative min-w-0 rounded-[18px] border border-[rgba(255,45,90,0.25)] p-1.5 sm:p-2 backdrop-blur-xl",
        "[background:linear-gradient(180deg,rgba(255,45,90,0.06),rgba(255,45,90,0)_120px),linear-gradient(180deg,rgba(24,4,11,0.65),rgba(14,2,7,0.75))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_-6px_rgba(255,31,90,0.25)]",
        "lt:border-slate-200 lt:[background:rgba(255,255,255,0.7)] lt:shadow-none",
        className,
      )}
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="relative" style={{ minWidth }}>
          {/* One band of light crossing the header strip, clipped to it. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-12 overflow-hidden rounded-[12px]">
            <span className="animate-panel-sweep absolute inset-y-0 left-0 w-1/5 bg-[linear-gradient(90deg,transparent,rgba(var(--tone-hi),0.2),transparent)] motion-reduce:hidden lt:bg-[linear-gradient(90deg,transparent,rgba(var(--tone),0.12),transparent)]" />
          </div>

          {/* isolate: the rows' hover layers sit at z -1, under the
              cells but over the frame's glass, which they would drop
              behind without a stacking context here. */}
          <table className={cn("isolate w-full border-separate border-spacing-0 text-left", tableClassName)}>
            <thead>
              <tr>
                {columns.map((column, i) => {
                  const spec = typeof column === "string" ? { label: column } : column;
                  const key = typeof column === "string" ? column : (column.key ?? String(i));
                  return (
                    <th
                      key={key}
                      scope="col"
                      className={cn(
                        "h-12 px-4 whitespace-nowrap first:pl-5 last:pr-5",
                        "text-[12px] font-bold tracking-[1.2px] text-[#ffd1dc] uppercase",
                        "border-b border-[rgba(255,45,90,0.22)] bg-[rgba(255,31,90,0.08)]",
                        "first:rounded-tl-[12px] last:rounded-tr-[12px]",
                        "lt:border-slate-200 lt:bg-slate-50 lt:text-slate-500",
                        ALIGN[spec.align ?? "left"],
                        spec.className,
                      )}
                    >
                      {spec.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {hasRows ? <tbody>{children}</tbody> : null}
          </table>
        </div>
      </div>
      {/* Outside the sideways scroller, so on a phone the message is
          centred in what you can see rather than across the full
          table width, half of it off screen. */}
      {hasRows ? null : <div className="pt-2">{empty ?? <NeonEmpty>Nothing here yet.</NeonEmpty>}</div>}
    </div>
  );
}

/** Row entrance stagger. Ten rows finish inside half a second. */
const STAGGER_MS = 45;
/** Past this many rows the stagger stops growing, so row 200 is not seconds late. */
const STAGGER_CAP = 14;

/**
 * A table row. `index` staggers its tip-in (the device-row-in keyframe);
 * leave it out to skip the entrance. `highlight` keeps the hover look
 * on -- the audit log's newest row. `tone` recolours this row's rim.
 */
export function NeonRow({
  index,
  highlight = false,
  tone,
  className,
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & {
  index?: number;
  highlight?: boolean;
  tone?: NeonTone;
}) {
  const animated = index !== undefined;
  return (
    <tr
      {...rest}
      style={{
        ...(tone ? toneVars(tone) : null),
        ...(animated ? { animationDelay: `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms` } : null),
        ...style,
      }}
      className={cn(
        "group/row relative",
        // Backwards fill only: once the entrance ends the row's own
        // transform applies again, which is what lets hover lift it.
        animated && "animate-device-row-in [animation-fill-mode:backwards]",
        "transition-[transform,box-shadow] duration-300 ease-smooth hover:z-[1] hover:-translate-y-0.5",
        "hover:shadow-[0_12px_22px_-10px_rgba(255,45,90,0.22)] lt:hover:shadow-[0_12px_18px_-11px_rgba(255,45,90,0.15)]",
        // Faint crimson rule under every row, and subtle crimson glass fill on hover.
        "[&>td]:border-b [&>td]:border-[rgba(255,45,90,0.1)] [&>td]:transition-colors [&>td]:duration-300",
        "hover:[&>td]:bg-[rgba(255,45,90,0.06)] [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl",
        // The neon red accent bar riding the left edge on hover
        "[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:inset-y-2 [&>td:first-child]:before:left-0 [&>td:first-child]:before:w-[3px] [&>td:first-child]:before:rounded-full [&>td:first-child]:before:content-['']",
        "[&>td:first-child]:before:bg-[#ff1f5a] [&>td:first-child]:before:opacity-0 [&>td:first-child]:before:shadow-[0_0_8px_rgba(255,31,90,0.6)] [&>td:first-child]:before:transition-opacity",
        "hover:[&>td:first-child]:before:opacity-100",
        "lt:[&>td]:border-slate-100 lt:hover:[&>td]:bg-slate-50",
        highlight && LIT,
        className,
      )}
    >
      {children}
    </tr>
  );
}

// The lit row's rim is four inset shadows split across its cells
const LIT = cn(
  "[&>td]:bg-[rgba(255,45,90,0.12)]",
  "[&>td]:shadow-[inset_0_1px_0_rgba(255,0,55,0.65),inset_0_-1px_0_rgba(255,0,55,0.65)]",
  "[&>td:first-child]:shadow-[inset_1px_0_0_rgba(255,0,55,0.65),inset_0_1px_0_rgba(255,0,55,0.65),inset_0_-1px_0_rgba(255,0,55,0.65),inset_14px_0_18px_-14px_rgba(255,0,55,0.35)]",
  "[&>td:last-child]:shadow-[inset_-1px_0_0_rgba(255,0,55,0.65),inset_0_1px_0_rgba(255,0,55,0.65),inset_0_-1px_0_rgba(255,0,55,0.65)]",
  "shadow-[0_6px_16px_-7px_rgba(255,0,55,0.36)]",
  "lt:[&>td]:bg-rose-50 lt:shadow-none",
);

/**
 * A table cell with the kit's padding. `mono` for keys, IPs and HWIDs:
 * those also never wrap -- a key broken over three lines reads as three
 * keys -- and the table scrolls sideways instead.
 */
export function NeonCell({
  align = "left",
  mono = false,
  className,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: NeonAlign; mono?: boolean }) {
  return (
    <td
      {...rest}
      className={cn(
        "h-[56px] px-4 py-2.5 align-middle text-[14px] text-[#e2e8ff] first:pl-5 last:pr-5 lt:text-slate-700",
        mono && "font-mono text-[14.5px] font-semibold whitespace-nowrap",
        ALIGN[align],
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * The empty state: a lit icon tile over a line of text, in a dashed
 * well (the vault's "Nothing is blocked" row). Works inside NeonTable's
 * `empty` or on its own.
 */
export function NeonEmpty({
  icon,
  tone = "violet",
  className,
  children,
}: {
  icon?: React.ReactNode;
  tone?: NeonTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={toneVars(tone)}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed px-6 py-8 text-center",
        "border-[rgba(var(--tone),0.4)] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(var(--tone),0.12),transparent_70%)]",
        "lt:border-slate-300 lt:bg-none",
        className,
      )}
    >
      {icon ? (
        <IconTile tone={tone} variant="glass" size="md">
          {icon}
        </IconTile>
      ) : null}
      <p className="max-w-[560px] text-[13.5px] leading-relaxed text-[#b6c2e8] lt:text-slate-500">{children}</p>
    </div>
  );
}
