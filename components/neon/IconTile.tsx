import { cn } from "@/lib/utils";

import { TONES, toneVars, type NeonTone } from "./tones";

export type IconTileSize = "xs" | "sm" | "md" | "lg";
export type IconTileVariant = "solid" | "glass" | "ring";

const SIZES: Record<IconTileSize, string> = {
  xs: "size-8 rounded-[10px] [&>svg]:size-4",
  sm: "size-10 rounded-[12px] [&>svg]:size-5",
  md: "size-12 rounded-[14px] [&>svg]:size-6",
  lg: "size-[58px] rounded-[16px] [&>svg]:size-7",
};

const VARIANTS: Record<IconTileVariant, string> = {
  // The vivid tile beside a panel title: a two-stop gradient under a
  // gloss that catches the top-left, a lighter rim, a white glyph.
  solid: cn(
    "border border-[rgba(var(--tone-hi),0.7)] text-white",
    "[background:radial-gradient(120%_75%_at_28%_0%,rgba(255,255,255,0.38),rgba(255,255,255,0)_58%),linear-gradient(180deg,rgba(6,8,30,0)_45%,rgba(6,8,30,0.32)),linear-gradient(145deg,var(--tone-a),var(--tone-b))]",
    "shadow-[0_0_13px_-2px_rgba(var(--tone),0.36),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-6px_14px_-6px_rgba(0,0,0,0.35)]",
    "[&>svg]:drop-shadow-[0_0_4px_rgba(255,255,255,0.22)]",
    "lt:shadow-[0_4px_10px_-4px_rgba(var(--tone),0.32),inset_0_1px_0_rgba(255,255,255,0.4)]",
  ),
  // Dark glass with the tone in the rim and a glowing glyph.
  glass: cn(
    "border border-[rgba(var(--tone),0.6)] text-[rgb(var(--tone-hi))]",
    "[background:radial-gradient(120%_75%_at_28%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_58%),linear-gradient(145deg,rgba(var(--tone),0.26),rgba(var(--tone),0.07)),#0a0d2c]",
    "shadow-[0_0_11px_-3px_rgba(var(--tone),0.34),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_14px_rgba(var(--tone),0.11)]",
    "[&>svg]:drop-shadow-[0_0_4px_rgba(var(--tone),0.38)]",
    "lt:[background:linear-gradient(145deg,rgba(var(--tone),0.14),rgba(var(--tone),0.04)),#fff] lt:text-[var(--tone-lt)] lt:shadow-none lt:[&>svg]:drop-shadow-none",
  ),
  // A lit ring, as on the history and audit stat tiles.
  ring: cn(
    "rounded-full border-2 border-[rgba(var(--tone-hi),0.85)] text-[rgb(var(--tone-hi))]",
    "[background:radial-gradient(circle_at_50%_40%,rgba(var(--tone),0.3),rgba(var(--tone),0.06)_70%)]",
    "shadow-[0_0_10px_-1px_rgba(var(--tone),0.38),inset_0_0_14px_rgba(var(--tone),0.2)]",
    "[&>svg]:drop-shadow-[0_0_4px_rgba(var(--tone),0.38)]",
    "lt:border-[rgba(var(--tone),0.7)] lt:text-[var(--tone-lt)] lt:shadow-[0_3px_7px_-3px_rgba(var(--tone),0.27)] lt:[&>svg]:drop-shadow-none",
  ),
};

/**
 * The rounded-square icon tile from the mockups' panel headers and stat
 * tiles. Pass the icon as the only child; the tile sizes it.
 *
 * `tone2` bends a solid tile's gradient toward a second tone -- the
 * reseller form's violet-to-magenta tile -- without a new preset.
 */
export function IconTile({
  tone = "violet",
  tone2,
  size = "md",
  variant = "solid",
  className,
  style,
  children,
  ...rest
}: {
  tone?: NeonTone;
  tone2?: NeonTone;
  size?: IconTileSize;
  variant?: IconTileVariant;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const vars = toneVars(tone) as Record<string, string>;
  if (tone2) vars["--tone-b"] = TONES[tone2].ink[1];

  return (
    <span
      aria-hidden
      {...rest}
      style={{ ...vars, ...style }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center [&>svg]:shrink-0",
        SIZES[size],
        VARIANTS[variant],
        variant === "ring" && "rounded-full",
        className,
      )}
    >
      {children}
    </span>
  );
}
