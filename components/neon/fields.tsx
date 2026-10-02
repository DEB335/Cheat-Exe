"use client";

import { useId, useRef } from "react";

import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { IconTile } from "./IconTile";
import { ChevronUpIcon } from "./icons";
import { toneVars, type NeonTone } from "./tones";

/* ------------------------------------------------------------------
   Label and help text
   ------------------------------------------------------------------ */

/** Upper-case, letter-spaced field label, with an optional note on the right. */
export function NeonLabel({
  aside,
  className,
  children,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement> & { aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <label
        {...rest}
        className={cn(
          "block text-[13px] leading-none font-bold tracking-[0.7px] text-[#cdd6f4] uppercase lt:text-slate-600",
          className,
        )}
      >
        {children}
      </label>
      {aside ? (
        <span className="flex items-center gap-1.5 text-[12.5px] leading-none font-semibold text-[#93c5fd] lt:text-blue-700 [&>svg]:size-3.5">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

/** The muted line under a field. `error` turns it red. */
export function NeonHelp({
  error = false,
  id,
  className,
  children,
}: {
  error?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn(
        "mt-2 flex items-center gap-1.5 text-[13px] leading-snug [&>svg]:size-3.5 [&>svg]:shrink-0",
        error ? "text-[#ff8aa0] lt:text-rose-600" : "text-[#a9b8e0] lt:text-slate-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------
   The shared field box
   ------------------------------------------------------------------ */

/**
 * Dark well with a thin indigo rim. Hover warms the rim toward the
 * field's tone; focus lights it fully and throws a halo, like the
 * mockups' active inputs.
 */
const BOX = cn(
  "relative flex min-w-0 items-stretch overflow-hidden rounded-[12px] border",
  "border-[rgba(110,118,245,0.4)] bg-[linear-gradient(180deg,rgba(4,6,26,0.86),rgba(7,10,34,0.8))]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_10px_22px_-16px_rgba(0,0,0,0.9)]",
  "transition-[border-color,box-shadow] duration-300 ease-smooth",
  "hover:border-[rgba(var(--tone),0.7)]",
  "focus-within:border-[rgb(var(--tone-hi))] hover:focus-within:border-[rgb(var(--tone-hi))]",
  "focus-within:shadow-[0_0_0_3px_rgba(var(--tone),0.18),0_0_13px_-2px_rgba(var(--tone),0.32),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "lt:border-slate-300 lt:bg-none lt:bg-white lt:shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]",
  "lt:hover:border-[rgba(var(--tone),0.6)] lt:focus-within:border-[rgb(var(--tone))] lt:focus-within:shadow-[0_0_0_3px_rgba(var(--tone),0.15)]",
);

const CONTROL = cn(
  "min-w-0 flex-1 bg-transparent px-4 font-medium text-white outline-none",
  "placeholder:text-[#7f8bb8] disabled:cursor-not-allowed disabled:opacity-55",
  "lt:text-slate-900 lt:placeholder:text-slate-400",
);

/** A separated, tinted cell on the left (Reseller Management). */
function IconCell({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex w-[54px] shrink-0 items-center justify-center border-r",
        "border-[rgba(var(--tone),0.42)] bg-[linear-gradient(180deg,rgba(var(--tone),0.26),rgba(var(--tone),0.08))]",
        "text-[rgb(var(--tone-hi))] [&>svg]:size-[22px] [&>svg]:drop-shadow-[0_0_4px_rgba(var(--tone),0.36)]",
        "lt:bg-none lt:bg-[rgba(var(--tone),0.08)] lt:text-[var(--tone-lt)] lt:[&>svg]:drop-shadow-none",
      )}
    >
      {children}
    </span>
  );
}

function LeftIcon({ icon, style, tone }: { icon: React.ReactNode; style: "cell" | "tile"; tone: NeonTone }) {
  return style === "cell" ? (
    <IconCell>{icon}</IconCell>
  ) : (
    // A glossy tile inset in the well (Whitelist Management).
    <span className="flex shrink-0 items-center pl-[7px]">
      <IconTile tone={tone} size="sm" variant="solid" className="[&>svg]:size-[19px]">
        {icon}
      </IconTile>
    </span>
  );
}

function RightIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none flex shrink-0 items-center pr-4 text-[#b8c4ea] lt:text-slate-400 [&>svg]:size-5"
    >
      {children}
    </span>
  );
}

interface FieldFrameProps {
  /** Upper-case label above the box. */
  label?: React.ReactNode;
  /** A note at the right end of the label row, e.g. "30 Days". */
  labelAside?: React.ReactNode;
  /** Muted line under the box. */
  help?: React.ReactNode;
  /** Shown in place of `help`, in red, and marks the control invalid. */
  error?: React.ReactNode;
  /** Tone of the focus glow and the icon cell. Default "violet". */
  tone?: NeonTone;
  /** Glyph on the left: a separated tinted cell, or an inset glossy tile. */
  leftIcon?: React.ReactNode;
  leftIconStyle?: "cell" | "tile";
  /** Decorative glyph on the right (calendar, users). */
  rightIcon?: React.ReactNode;
  /** Interactive content on the right, inside the box: a copy or reveal button. */
  rightSlot?: React.ReactNode;
  /** "md" is the mockups' 54px field; "sm" 46px. */
  size?: "sm" | "md";
  /** Classes for the outer wrapper (label + box + help). */
  className?: string;
  /** Classes for the box itself. */
  boxClassName?: string;
}

function useFieldIds(id: string | undefined) {
  const auto = useId();
  const controlId = id ?? `nf${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return { controlId, helpId: `${controlId}-help` };
}

/** Assigns an element to both the kit's own ref and the caller's. */
function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as React.RefObject<T | null>).current = value;
}

/* ------------------------------------------------------------------
   NeonInput
   ------------------------------------------------------------------ */

interface NeonInputProps extends FieldFrameProps, Omit<React.ComponentPropsWithRef<"input">, "size" | "className"> {
  /** Up/down buttons at the right end, for type="number". Fires onChange like typing does. */
  stepper?: boolean;
  /**
   * "plain": label above a box. "card": the profile page's tinted card,
   * the label and its glyph (`leftIcon`) on a row inside it, over the box.
   */
  variant?: "plain" | "card";
  /** Classes for the <input> element. */
  inputClassName?: string;
}

/**
 * The kit's text field. Every input prop passes straight through, and
 * `ref` reaches the <input>. The label is tied to it with htmlFor, and
 * the help or error line with aria-describedby.
 */
export function NeonInput({
  label,
  labelAside,
  help,
  error,
  tone = "violet",
  leftIcon,
  leftIconStyle = "cell",
  rightIcon,
  rightSlot,
  size = "md",
  stepper = false,
  variant = "plain",
  className,
  boxClassName,
  inputClassName,
  id,
  ref,
  style,
  ...rest
}: NeonInputProps) {
  const { controlId, helpId } = useFieldIds(id);
  const inner = useRef<HTMLInputElement | null>(null);
  const note = error ?? help;
  const card = variant === "card";

  // stepUp() moves the value the browser's way (min, max and step all
  // respected); the synthetic input event is what React listens to, so
  // the caller's onChange runs exactly as if the user had typed it.
  const step = (dir: 1 | -1) => {
    const el = inner.current;
    if (!el || el.disabled || el.readOnly) return;
    try {
      if (dir > 0) el.stepUp();
      else el.stepDown();
    } catch {
      return;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const box = (
    <div
      className={cn(
        BOX,
        card ? "h-[48px] rounded-[10px] border-[rgba(var(--tone),0.45)]" : size === "md" ? "h-[54px]" : "h-[46px]",
        boxClassName,
      )}
    >
      {leftIcon && !card ? <LeftIcon icon={leftIcon} style={leftIconStyle} tone={tone} /> : null}
      <input
        {...rest}
        id={controlId}
        ref={(el) => {
          inner.current = el;
          assignRef(ref, el);
        }}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={note ? helpId : rest["aria-describedby"]}
        className={cn(
          CONTROL,
          card ? "text-[14.5px]" : "text-[15.5px]",
          stepper && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          inputClassName,
        )}
      />
      {rightSlot ? <span className="flex shrink-0 items-center gap-1 pr-2">{rightSlot}</span> : null}
      {rightIcon && !rightSlot ? <RightIcon>{rightIcon}</RightIcon> : null}
      {stepper ? (
        <span className="my-[7px] mr-[7px] flex w-9 shrink-0 flex-col overflow-hidden rounded-[9px] border border-[rgba(var(--tone),0.45)] bg-[rgba(var(--tone),0.1)] lt:bg-[rgba(var(--tone),0.06)]">
          {([1, -1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              tabIndex={-1}
              aria-label={dir > 0 ? "Increase" : "Decrease"}
              onClick={() => step(dir)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center text-[rgb(var(--tone-hi))]",
                "transition-colors duration-150 hover:bg-[rgba(var(--tone),0.28)] hover:text-white active:bg-[rgba(var(--tone),0.4)]",
                "lt:text-[var(--tone-lt)] lt:hover:bg-[rgba(var(--tone),0.14)] lt:hover:text-[var(--tone-lt)]",
                dir < 0 && "border-t border-[rgba(var(--tone),0.3)]",
              )}
            >
              {dir > 0 ? <ChevronUpIcon className="size-3.5" strokeWidth={2.6} /> : <ChevronDownIcon className="size-3.5" strokeWidth={2.6} />}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );

  return (
    <div style={{ ...toneVars(tone), ...style }} className={cn("min-w-0", className)}>
      {card ? (
        <div
          className={cn(
            "rounded-[14px] border border-[rgba(var(--tone),0.55)] px-3.5 pt-3 pb-3.5",
            "[background:radial-gradient(80%_120%_at_0%_0%,rgba(var(--tone),0.16),transparent_70%),linear-gradient(160deg,rgba(10,14,44,0.7),rgba(6,8,30,0.75))]",
            "shadow-[0_0_12px_-4px_rgba(var(--tone),0.36),inset_0_1px_0_rgba(255,255,255,0.06)]",
            "transition-[border-color,box-shadow] duration-300 focus-within:border-[rgba(var(--tone-hi),0.9)]",
            "focus-within:shadow-[0_0_14px_-3px_rgba(var(--tone),0.48),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "lt:border-[rgba(var(--tone),0.4)] lt:[background:rgba(var(--tone),0.05)] lt:shadow-none",
          )}
        >
          {label ? (
            <label
              htmlFor={controlId}
              className="mb-2.5 flex items-center gap-3 pl-1 text-[14.5px] font-semibold text-[#dbe4ff] lt:text-slate-700"
            >
              {leftIcon ? (
                <span
                  aria-hidden
                  className="flex text-[rgb(var(--tone-hi))] drop-shadow-[0_0_4px_rgba(var(--tone),0.36)] lt:text-[var(--tone-lt)] lt:drop-shadow-none [&>svg]:size-5"
                >
                  {leftIcon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {labelAside}
            </label>
          ) : null}
          {box}
        </div>
      ) : (
        <>
          {label ? (
            <NeonLabel htmlFor={controlId} aside={labelAside}>
              {label}
            </NeonLabel>
          ) : null}
          {box}
        </>
      )}
      {note ? (
        <NeonHelp id={helpId} error={Boolean(error)}>
          {note}
        </NeonHelp>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   NeonSelect
   ------------------------------------------------------------------ */

interface NeonSelectProps
  extends Omit<FieldFrameProps, "rightIcon" | "rightSlot">,
    Omit<React.ComponentPropsWithRef<"select">, "size" | "className"> {
  selectClassName?: string;
}

/**
 * A native select in the field box. The chevron is a real element with
 * pointer-events off, so clicking it opens the menu like the rest.
 */
export function NeonSelect({
  label,
  labelAside,
  help,
  error,
  tone = "violet",
  leftIcon,
  leftIconStyle = "cell",
  size = "md",
  className,
  boxClassName,
  selectClassName,
  id,
  style,
  children,
  ...rest
}: NeonSelectProps) {
  const { controlId, helpId } = useFieldIds(id);
  const note = error ?? help;
  return (
    <div style={{ ...toneVars(tone), ...style }} className={cn("min-w-0", className)}>
      {label ? (
        <NeonLabel htmlFor={controlId} aside={labelAside}>
          {label}
        </NeonLabel>
      ) : null}
      <div className={cn(BOX, size === "md" ? "h-[54px]" : "h-[46px]", boxClassName)}>
        {leftIcon ? <LeftIcon icon={leftIcon} style={leftIconStyle} tone={tone} /> : null}
        <select
          {...rest}
          id={controlId}
          aria-invalid={error ? true : rest["aria-invalid"]}
          aria-describedby={note ? helpId : rest["aria-describedby"]}
          className={cn(
            CONTROL,
            "cursor-pointer appearance-none pr-11 text-[15.5px]",
            "[&>option]:bg-[#0b1033] [&>option]:text-white lt:[&>option]:bg-white lt:[&>option]:text-slate-900",
            selectClassName,
          )}
        >
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-[#b8c4ea] lt:text-slate-400"
        />
      </div>
      {note ? (
        <NeonHelp id={helpId} error={Boolean(error)}>
          {note}
        </NeonHelp>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   NeonTextarea
   ------------------------------------------------------------------ */

interface NeonTextareaProps
  extends Pick<FieldFrameProps, "label" | "labelAside" | "help" | "error" | "tone" | "className" | "boxClassName">,
    Omit<React.ComponentPropsWithRef<"textarea">, "className"> {
  textareaClassName?: string;
}

export function NeonTextarea({
  label,
  labelAside,
  help,
  error,
  tone = "violet",
  className,
  boxClassName,
  textareaClassName,
  id,
  style,
  ...rest
}: NeonTextareaProps) {
  const { controlId, helpId } = useFieldIds(id);
  const note = error ?? help;
  return (
    <div style={{ ...toneVars(tone), ...style }} className={cn("min-w-0", className)}>
      {label ? (
        <NeonLabel htmlFor={controlId} aside={labelAside}>
          {label}
        </NeonLabel>
      ) : null}
      <div className={cn(BOX, boxClassName)}>
        <textarea
          {...rest}
          id={controlId}
          aria-invalid={error ? true : rest["aria-invalid"]}
          aria-describedby={note ? helpId : rest["aria-describedby"]}
          className={cn(CONTROL, "min-h-[120px] resize-y py-3.5 text-[15px] leading-relaxed", textareaClassName)}
        />
      </div>
      {note ? (
        <NeonHelp id={helpId} error={Boolean(error)}>
          {note}
        </NeonHelp>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   NeonToggle
   ------------------------------------------------------------------ */

/**
 * A switch with a title and a line of description -- "Lock to one
 * device". The whole row is its label, so clicking anywhere on it
 * flips the switch; the switch itself is a real role="switch" button.
 */
export function NeonToggle({
  checked,
  onChange,
  title,
  description,
  tone = "blue",
  disabled = false,
  boxed = true,
  id,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: NeonTone;
  disabled?: boolean;
  /** Draw the row as a bordered well (default), or bare. */
  boxed?: boolean;
  id?: string;
  className?: string;
}) {
  const { controlId, helpId } = useFieldIds(id);
  return (
    <label
      htmlFor={controlId}
      style={toneVars(tone)}
      className={cn(
        "flex items-center gap-4",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        boxed && [
          "rounded-[14px] border border-[rgba(110,118,245,0.34)] px-4 py-3.5 sm:px-5",
          "[background:linear-gradient(90deg,rgba(var(--tone),0.1),rgba(var(--tone),0)_45%),linear-gradient(180deg,rgba(6,9,32,0.75),rgba(4,6,24,0.7))]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color] duration-300",
          !disabled && "hover:border-[rgba(var(--tone),0.6)]",
          "lt:border-slate-200 lt:[background:rgba(var(--tone),0.04)]",
        ],
        className,
      )}
    >
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? helpId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[30px] w-[56px] shrink-0 cursor-pointer rounded-full border transition-[background,border-color,box-shadow] duration-300",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))] disabled:cursor-not-allowed",
          checked
            ? [
                "border-[rgba(var(--tone-hi),0.8)] [background:linear-gradient(90deg,var(--tone-b),var(--tone-a))]",
                "shadow-[0_0_10px_-1px_rgba(var(--tone),0.38),inset_0_1px_0_rgba(255,255,255,0.3)]",
              ]
            : "border-[rgba(148,163,204,0.35)] bg-[rgba(148,163,204,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] lt:bg-slate-200",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white transition-[translate,box-shadow] duration-300 ease-back",
            checked
              ? "translate-x-[26px] shadow-[0_0_6px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.3)]"
              : "shadow-[0_2px_4px_rgba(0,0,0,0.35)]",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-bold text-white lt:text-slate-900">{title}</span>
        {description ? (
          <span id={helpId} className="mt-1 block text-[13px] leading-snug text-[#a9b8e0] lt:text-slate-500">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------
   NeonSegmented
   ------------------------------------------------------------------ */

export interface SegmentOption<V extends string | number> {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Colour of this option when chosen; defaults to the group's tone. */
  tone?: NeonTone;
  disabled?: boolean;
}

/**
 * A row of choice buttons, one of which is lit: the vault's IP / HWID /
 * SIGNATURE switch, the whitelist's 1 Day ... Lifetime presets. A
 * radiogroup underneath, with arrow keys moving the choice.
 *
 * `value` may match no option (a custom day count typed in the field
 * beside it): then nothing is lit and the first option takes Tab.
 */
export function NeonSegmented<V extends string | number>({
  options,
  value,
  onChange,
  tone = "violet",
  size = "sm",
  caps = false,
  className,
  ...aria
}: {
  options: SegmentOption<V>[];
  value: V | null | undefined;
  onChange: (value: V) => void;
  tone?: NeonTone;
  size?: "xs" | "sm" | "md";
  /** Upper-case, letter-spaced labels (IP / HWID / SIGNATURE). */
  caps?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = options.findIndex((o) => o.value === value);

  const move = (from: number, dir: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + dir * i + options.length) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div role="radiogroup" {...aria} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option, i) => {
        const on = i === chosen;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={option.disabled}
            tabIndex={on || (chosen === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(i, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(i, -1);
              }
            }}
            style={toneVars(option.tone ?? tone)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border font-semibold whitespace-nowrap select-none [&_svg]:size-3.5 [&_svg]:shrink-0",
              size === "xs" && "h-8 rounded-[9px] px-2.5 text-[12px]",
              size === "sm" && "h-9 rounded-[10px] px-3.5 text-[13px]",
              size === "md" && "h-11 rounded-[12px] px-5 text-[14px]",
              caps && "tracking-[0.8px] uppercase",
              "transition-[translate,scale,background-color,border-color,box-shadow,color] duration-200 ease-smooth",
              "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))]",
              on
                ? [
                    "border-[rgb(var(--tone-hi))] text-white",
                    "[background:linear-gradient(180deg,rgba(var(--tone),0.62),rgba(var(--tone),0.26))]",
                    "shadow-[0_0_11px_-1px_rgba(var(--tone),0.38),inset_0_1px_0_rgba(255,255,255,0.3)]",
                    "lt:border-[rgb(var(--tone))] lt:[background:rgba(var(--tone),0.14)] lt:text-[var(--tone-lt)] lt:shadow-none",
                  ]
                : option.tone
                  ? [
                      // An option with a colour of its own (Lifetime) wears
                      // it faintly even when not chosen, as in the mockup.
                      "border-[rgba(var(--tone),0.55)] bg-[rgba(var(--tone),0.1)] text-[rgb(var(--tone-hi))]",
                      "hover:border-[rgba(var(--tone),0.85)] hover:bg-[rgba(var(--tone),0.18)] hover:text-white",
                      "lt:border-[rgba(var(--tone),0.45)] lt:bg-[rgba(var(--tone),0.06)] lt:text-[var(--tone-lt)] lt:hover:bg-[rgba(var(--tone),0.12)] lt:hover:text-[var(--tone-lt)]",
                    ]
                  : [
                      "border-[rgba(129,140,248,0.3)] bg-[rgba(10,14,44,0.72)] text-[#cdd6f4]",
                      "hover:border-[rgba(var(--tone),0.75)] hover:bg-[rgba(var(--tone),0.12)] hover:text-white",
                      "lt:border-slate-300 lt:bg-white lt:text-slate-600 lt:hover:border-[rgba(var(--tone),0.6)] lt:hover:bg-[rgba(var(--tone),0.06)] lt:hover:text-slate-900",
                    ],
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
