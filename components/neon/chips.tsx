import { BoltIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { CrownIcon, CubeIcon, DiamondIcon, GearIcon, LayersIcon, RocketIcon, ShieldIcon, ShieldPlusIcon } from "./icons";
import { STATUS_TONES, packageLook, toneVars, type NeonStatus, type NeonTone, type PackageGlyph } from "./tones";

/* ------------------------------------------------------------------
   NeonChip
   ------------------------------------------------------------------ */

export type NeonChipSize = "xs" | "sm" | "md";

const CHIP_SIZES: Record<NeonChipSize, { box: string; square: string }> = {
  xs: { box: "h-[22px] gap-1 px-2 text-[10.5px] [&_svg]:size-3", square: "size-[22px] [&_svg]:size-3" },
  sm: { box: "h-[26px] gap-1.5 px-2.5 text-[11.5px] [&_svg]:size-[13px]", square: "size-[26px] [&_svg]:size-[14px]" },
  md: { box: "h-[30px] gap-2 px-3 text-[12.5px] [&_svg]:size-[15px]", square: "size-[30px] [&_svg]:size-4" },
};

interface NeonChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: NeonTone;
  size?: NeonChipSize;
  /** "tag" is the squared package label; "pill" fully rounded. */
  shape?: "tag" | "pill";
  icon?: React.ReactNode;
  /** A glowing dot before the label (ignored when `icon` is set). */
  dot?: boolean;
  /** Upper-case, letter-spaced label. Default true. */
  caps?: boolean;
}

/**
 * A small lit label: tinted glass, a rim in the tone, bright text. With
 * no children it is a square icon chip (the reseller table's package
 * cubes) -- give it a title or aria-label.
 */
export function NeonChip({
  tone = "violet",
  size = "sm",
  shape = "tag",
  icon,
  dot = false,
  caps = true,
  className,
  style,
  children,
  ...rest
}: NeonChipProps) {
  const square = children === undefined || children === null || children === false;
  return (
    <span
      {...rest}
      style={{ ...toneVars(tone), ...style }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border leading-none font-bold whitespace-nowrap",
        "border-[rgba(var(--tone),0.65)] text-[rgb(var(--tone-hi))]",
        "bg-[linear-gradient(180deg,rgba(var(--tone),0.24),rgba(var(--tone),0.08))]",
        "shadow-[0_0_12px_-4px_rgba(var(--tone),0.75),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "[&_svg]:shrink-0 [&_svg]:drop-shadow-[0_0_4px_rgba(var(--tone),0.9)]",
        "lt:border-[rgba(var(--tone),0.45)] lt:bg-none lt:bg-[rgba(var(--tone),0.1)] lt:text-[var(--tone-lt)] lt:shadow-none lt:[&_svg]:drop-shadow-none",
        caps && "tracking-[0.6px] uppercase",
        square ? CHIP_SIZES[size].square : CHIP_SIZES[size].box,
        shape === "pill" ? "rounded-full" : "rounded-[7px]",
        className,
      )}
    >
      {icon ??
        (dot ? (
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-[rgb(var(--tone-hi))] shadow-[0_0_6px_rgb(var(--tone))] lt:bg-[var(--tone-lt)] lt:shadow-none"
          />
        ) : null)}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------
   Packages
   ------------------------------------------------------------------ */

const GLYPHS: Record<PackageGlyph, (p: React.SVGProps<SVGSVGElement>) => React.ReactNode> = {
  layers: LayersIcon,
  bolt: BoltIcon,
  shield: ShieldIcon,
  "shield-plus": ShieldPlusIcon,
  diamond: DiamondIcon,
  crown: CrownIcon,
  rocket: RocketIcon,
  gear: GearIcon,
  cube: CubeIcon,
};

/** The glyph a package wears (see packageTone in tones.ts). Unknown names get a cube. */
export function PackageIcon({ name, className }: { name: string; className?: string }) {
  const Glyph = GLYPHS[packageLook(name).glyph];
  return <Glyph aria-hidden className={className} />;
}

/**
 * A package name as a chip in its own colour and glyph. `iconOnly`
 * gives the reseller table's compact square, named by its tooltip.
 */
export function PackageChip({
  name,
  size = "sm",
  iconOnly = false,
  className,
}: {
  name: string;
  size?: NeonChipSize;
  iconOnly?: boolean;
  className?: string;
}) {
  const { tone } = packageLook(name);
  return (
    <NeonChip
      tone={tone}
      size={size}
      icon={<PackageIcon name={name} />}
      title={iconOnly ? name : undefined}
      aria-label={iconOnly ? name : undefined}
      role={iconOnly ? "img" : undefined}
      className={className}
    >
      {iconOnly ? null : name}
    </NeonChip>
  );
}

/* ------------------------------------------------------------------
   StatusPill
   ------------------------------------------------------------------ */

/**
 * A status as a glowing pill with a dot: audit "Success" / "Warning" /
 * "Info", reseller "ACTIVE", device "BOUND".
 *
 * `live` sends a ring out of the dot now and then (transform and
 * opacity only, so it stays on the compositor). `tone` overrides the
 * status colour, e.g. cyan for BOUND.
 */
export function StatusPill({
  status = "neutral",
  tone,
  live = false,
  caps = false,
  size = "sm",
  className,
  children,
}: {
  status?: NeonStatus;
  tone?: NeonTone;
  live?: boolean;
  /** Upper-case label, as in "ACTIVE". Default false ("Success"). */
  caps?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  const t = tone ?? STATUS_TONES[status];
  return (
    <span
      style={toneVars(t)}
      className={cn(
        "inline-flex w-max shrink-0 items-center rounded-full border leading-none font-bold whitespace-nowrap",
        size === "xs" && "h-[22px] gap-1.5 px-2.5 text-[10.5px]",
        size === "sm" && "h-[26px] gap-2 px-3 text-[12px]",
        size === "md" && "h-[30px] gap-2 px-3.5 text-[13px]",
        caps && "tracking-[0.8px] uppercase",
        "border-[rgba(var(--tone),0.6)] text-[rgb(var(--tone-hi))]",
        "bg-[linear-gradient(180deg,rgba(var(--tone),0.3),rgba(var(--tone),0.1))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-2px_4px_rgba(0,0,0,0.2),0_0_14px_-3px_rgba(var(--tone),0.7)]",
        "lt:border-[rgba(var(--tone),0.45)] lt:bg-none lt:bg-[rgba(var(--tone),0.1)] lt:text-[var(--tone-lt)] lt:shadow-none",
        className,
      )}
    >
      <span className="relative flex size-2 shrink-0">
        {live ? (
          <span aria-hidden className="animate-status-ping absolute inset-0 rounded-full bg-[rgb(var(--tone))]" />
        ) : null}
        <span className="relative size-2 rounded-full bg-[rgb(var(--tone-hi))] shadow-[0_0_7px_rgb(var(--tone))] lt:bg-[var(--tone-lt)] lt:shadow-none" />
      </span>
      {children}
    </span>
  );
}
