import { Children } from "react";

import { cn } from "@/lib/utils";

import { IconTile } from "./IconTile";
import { toneVars, type NeonTone } from "./tones";

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
  tone = "blue",
  className,
  tableClassName,
  children,
}: {
  columns: NeonColumn[];
  /** Below this width (CSS px) the table scrolls inside its container. */
  minWidth?: number;
  /** Shown when there are no rows, e.g. <NeonEmpty .../>. */
  empty?: React.ReactNode;
  /** The row hover rim and header light. Default "blue". */
  tone?: NeonTone;
  className?: string;
  tableClassName?: string;
  children?: React.ReactNode;
}) {
  const hasRows = Children.toArray(children).length > 0;

  return (
    <div
      style={toneVars(tone)}
      className={cn(
        "relative min-w-0 rounded-[18px] border border-[rgba(110,118,245,0.32)] p-1.5 sm:p-2",
        "[background:linear-gradient(180deg,rgba(var(--tone),0.06),rgba(var(--tone),0)_120px),linear-gradient(180deg,rgba(5,8,30,0.62),rgba(4,6,24,0.7))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_14px_-6px_rgba(var(--tone),0.27)]",
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

          <table className={cn("w-full border-separate border-spacing-0 text-left", tableClassName)}>
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
                        "text-[12px] font-bold tracking-[1.2px] text-[#c7d2fe] uppercase",
                        "border-b border-[rgba(129,140,248,0.28)] bg-[rgba(99,102,241,0.08)]",
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
        "transition-[translate,box-shadow] duration-300 ease-smooth hover:z-[1] hover:-translate-y-px",
        // Faint rule under every row; the lit rim is drawn with inset
        // shadows on the cells, which follow the end cells' rounding.
        "[&>td]:border-b [&>td]:border-[rgba(129,140,248,0.12)] [&>td]:transition-[background-color,box-shadow] [&>td]:duration-300",
        "[&>td:first-child]:rounded-l-[12px] [&>td:last-child]:rounded-r-[12px]",
        "lt:[&>td]:border-slate-100",
        highlight ? LIT : HOVER_LIT,
        className,
      )}
    >
      {children}
    </tr>
  );
}

// The row's rim is four inset shadows split across its cells: top and
// bottom on every cell, left on the first, right on the last.
const LIT = cn(
  "[&>td]:bg-[rgba(var(--tone),0.12)]",
  "[&>td]:shadow-[inset_0_1px_0_rgba(var(--tone-hi),0.65),inset_0_-1px_0_rgba(var(--tone-hi),0.65)]",
  "[&>td:first-child]:shadow-[inset_1px_0_0_rgba(var(--tone-hi),0.65),inset_0_1px_0_rgba(var(--tone-hi),0.65),inset_0_-1px_0_rgba(var(--tone-hi),0.65),inset_14px_0_18px_-14px_rgba(var(--tone),0.35)]",
  "[&>td:last-child]:shadow-[inset_-1px_0_0_rgba(var(--tone-hi),0.65),inset_0_1px_0_rgba(var(--tone-hi),0.65),inset_0_-1px_0_rgba(var(--tone-hi),0.65)]",
  "shadow-[0_6px_16px_-7px_rgba(var(--tone),0.36)]",
  "lt:[&>td]:bg-[rgba(var(--tone),0.07)] lt:shadow-none",
);

const HOVER_LIT = cn(
  "hover:[&>td]:bg-[rgba(var(--tone),0.1)]",
  "hover:[&>td]:shadow-[inset_0_1px_0_rgba(var(--tone-hi),0.6),inset_0_-1px_0_rgba(var(--tone-hi),0.6)]",
  "hover:[&>td:first-child]:shadow-[inset_1px_0_0_rgba(var(--tone-hi),0.6),inset_0_1px_0_rgba(var(--tone-hi),0.6),inset_0_-1px_0_rgba(var(--tone-hi),0.6),inset_14px_0_18px_-14px_rgba(var(--tone),0.35)]",
  "hover:[&>td:last-child]:shadow-[inset_-1px_0_0_rgba(var(--tone-hi),0.6),inset_0_1px_0_rgba(var(--tone-hi),0.6),inset_0_-1px_0_rgba(var(--tone-hi),0.6)]",
  "hover:shadow-[0_6px_16px_-7px_rgba(var(--tone),0.36)]",
  "lt:hover:[&>td]:bg-[rgba(var(--tone),0.06)] lt:hover:shadow-[0_6px_14px_-8px_rgba(var(--tone),0.22)]",
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
