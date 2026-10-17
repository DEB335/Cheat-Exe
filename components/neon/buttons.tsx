import { ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { SpinnerIcon } from "./icons";
import { toneVars, type NeonTone } from "./tones";

/* ------------------------------------------------------------------
   NeonCta: the big primary pill.
   ------------------------------------------------------------------ */

interface NeonCtaProps extends React.ComponentPropsWithRef<"button"> {
  /** Leading glyph; swapped for a spinner while `loading`. */
  icon?: React.ReactNode;
  /** Adds the ">" after the label, which steps forward on hover. */
  chevron?: boolean;
  /** Disables the button and shows a spinner, keeping its width. */
  loading?: boolean;
  /** "lg" is 60px tall (GENERATE KEYS); "md" 50px, for a CTA inside a card. */
  size?: "md" | "lg";
}

/**
 * GENERATE KEYS / CREATE USER / ADD UID / Save Changes.
 *
 * The button's own background is the rim -- pale blue through lilac to
 * a hot pink -- showing round a 1.5px inset face that runs electric
 * blue to violet to magenta under a gloss. A blurred band of the same
 * colours sits under it as the bloom the mockups throw onto the floor.
 * Hover brightens and grows it a touch; a press sinks it.
 *
 * `type` defaults to "button"; pass type="submit" inside a form.
 */
export function NeonCta({
  icon,
  chevron = false,
  loading = false,
  size = "lg",
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: NeonCtaProps) {
  const lg = size === "lg";
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "group/cta relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-[1.5px] select-none",
        lg ? "h-[54px] min-w-[260px]" : "h-[46px] min-w-[200px]",
        "[background:linear-gradient(90deg,#ff1f5a_0%,#e11d48_50%,#b91c1c_100%)]",
        "shadow-[0_4px_20px_rgba(255,20,60,0.45),0_0_12px_rgba(255,31,90,0.3)]",
        "transition-[translate,scale,filter,box-shadow] duration-300 ease-smooth",
        "hover:-translate-y-0.5 hover:scale-[1.02] hover:brightness-[1.1]",
        "hover:shadow-[0_6px_28px_rgba(255,20,60,0.6),0_0_20px_rgba(255,31,90,0.4)]",
        "active:translate-y-0 active:scale-[0.98] active:duration-100",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff4d79]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-[0.6] disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:brightness-100",
        "lt:shadow-[0_6px_14px_-7px_rgba(225,29,72,0.32)]",
        className,
      )}
    >
      {/* Bloom under the pill */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-[10%] -bottom-2 -z-10 h-6 rounded-full opacity-[0.45] blur-[10px]",
          "bg-[linear-gradient(90deg,#ff1f5a,#e11d48_50%,#be123c)] transition-opacity duration-300",
          "group-hover/cta:opacity-[0.65]",
        )}
      />
      <span
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          lg ? "gap-3.5 px-9" : "gap-3 px-7",
          "[background:linear-gradient(90deg,#ff0037_0%,#e60032_50%,#cc002c_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_16px_-8px_rgba(100,0,20,0.5)]",
        )}
      >
        {/* Subtle sheen across top */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-b-[40%] bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0))]"
        />
        {loading ? (
          <SpinnerIcon className={cn("relative shrink-0 text-white", lg ? "size-6" : "size-5")} />
        ) : icon ? (
          <span
            aria-hidden
            className={cn(
              "relative flex shrink-0 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.28)]",
              lg ? "[&>svg]:size-6" : "[&>svg]:size-5",
            )}
          >
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            "relative font-display font-bold whitespace-nowrap text-white uppercase [text-shadow:0_0_7px_rgba(255,255,255,0.18)]",
            lg ? "text-[16px] tracking-[3px]" : "text-[14px] tracking-[2.4px]",
          )}
        >
          {children}
        </span>
        {chevron ? (
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "relative shrink-0 text-white transition-transform duration-300 ease-smooth group-hover/cta:translate-x-1",
              lg ? "ml-2 size-5" : "ml-1 size-4",
            )}
            strokeWidth={2.5}
          />
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------
   NeonButton: tinted outline / filled buttons.
   ------------------------------------------------------------------ */

export type NeonButtonVariant = "outline" | "filled" | "ghost";
export type NeonButtonSize = "xs" | "sm" | "md";

const SIZES: Record<NeonButtonSize, { box: string; square: string; icon: string }> = {
  xs: { box: "h-8 gap-1.5 rounded-[9px] px-3 text-[12px]", square: "size-8 rounded-[9px]", icon: "[&_svg]:size-3.5" },
  sm: { box: "h-9 gap-2 rounded-[10px] px-3.5 text-[13px]", square: "size-9 rounded-[10px]", icon: "[&_svg]:size-4" },
  md: { box: "h-11 gap-2.5 rounded-[12px] px-5 text-[14px]", square: "size-11 rounded-[12px]", icon: "[&_svg]:size-[18px]" },
};

const VARIANTS: Record<NeonButtonVariant, string> = {
  // Header actions: Refresh History, Clear Vault, Copy, Lookup.
  outline: cn(
    "border border-[rgba(var(--tone),0.7)] bg-[rgba(var(--tone),0.09)] text-[rgb(var(--tone-hi))]",
    "shadow-[0_0_8px_-2px_rgba(var(--tone),0.3),inset_0_0_12px_rgba(var(--tone),0.07)]",
    "hover:border-[rgb(var(--tone-hi))] hover:bg-[rgba(var(--tone),0.2)] hover:text-white",
    "hover:shadow-[0_0_10px_-2px_rgba(var(--tone),0.4),inset_0_0_14px_rgba(var(--tone),0.1)]",
    "lt:border-[rgba(var(--tone),0.55)] lt:bg-white lt:text-[var(--tone-lt)] lt:shadow-[0_2px_5px_-2px_rgba(var(--tone),0.2)]",
    "lt:hover:border-[rgb(var(--tone))] lt:hover:bg-[rgba(var(--tone),0.08)] lt:hover:text-[var(--tone-lt)] lt:hover:shadow-[0_3px_7px_-2px_rgba(var(--tone),0.26)]",
  ),
  // Row actions: Suspend, Perms, Pass, Renew, Reset HWID, Delete, Extend.
  filled: cn(
    "border border-[rgba(var(--tone-hi),0.7)] text-white",
    "[background:linear-gradient(180deg,rgba(var(--tone),0.5),rgba(var(--tone),0.2))]",
    "shadow-[0_0_10px_-2px_rgba(var(--tone),0.38),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_12px_rgba(var(--tone),0.15)]",
    "hover:border-[rgb(var(--tone-hi))] hover:[background:linear-gradient(180deg,rgba(var(--tone),0.68),rgba(var(--tone),0.32))]",
    "hover:shadow-[0_0_12px_-2px_rgba(var(--tone),0.5),inset_0_1px_0_rgba(255,255,255,0.34),inset_0_0_14px_rgba(var(--tone),0.2)]",
    "lt:border-[rgba(var(--tone),0.55)] lt:[background:rgba(var(--tone),0.12)] lt:text-[var(--tone-lt)] lt:shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
    "lt:hover:border-[rgb(var(--tone))] lt:hover:[background:rgba(var(--tone),0.2)] lt:hover:text-[var(--tone-lt)] lt:hover:shadow-[0_3px_7px_-2px_rgba(var(--tone),0.26)]",
  ),
  // Bare glyph or text in the tone, for dense spots (copy in a cell).
  ghost: cn(
    "border border-transparent text-[rgb(var(--tone-hi))]",
    "hover:bg-[rgba(var(--tone),0.16)] hover:text-white",
    "lt:text-[var(--tone-lt)] lt:hover:bg-[rgba(var(--tone),0.1)] lt:hover:text-[var(--tone-lt)]",
  ),
};

interface NeonButtonProps extends React.ComponentPropsWithRef<"button"> {
  tone?: NeonTone;
  variant?: NeonButtonVariant;
  size?: NeonButtonSize;
  /** Leading glyph; swapped for a spinner while `loading`. */
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
}

/**
 * The tinted buttons of the mockups. With no children it is a square
 * icon button -- give it an aria-label.
 *
 * Hover lifts it 2px and brightens the tint; a press scales it down.
 * `type` defaults to "button".
 */
export function NeonButton({
  tone = "violet",
  variant = "outline",
  size = "sm",
  icon,
  trailingIcon,
  loading = false,
  disabled,
  type = "button",
  className,
  style,
  children,
  ...rest
}: NeonButtonProps) {
  const square = children === undefined || children === null || children === false;
  const s = SIZES[size];
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ ...toneVars(tone), ...style }}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap select-none",
        "transition-[translate,scale,background-color,border-color,box-shadow,color] duration-200 ease-smooth",
        "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.95] active:duration-75",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
        "[&_svg]:shrink-0",
        square ? s.square : s.box,
        s.icon,
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <SpinnerIcon /> : icon}
      {children}
      {trailingIcon}
    </button>
  );
}
