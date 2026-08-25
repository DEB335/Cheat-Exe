"use client";

import { cn } from "@/lib/utils";

export function FormLabel({
  children,
  className,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...rest}
      className={cn(
        "mb-2.5 block text-[12px] font-bold tracking-[0.5px] text-muted uppercase",
        className,
      )}
    >
      {children}
    </label>
  );
}

/** Matches `.form-control` from the original stylesheet. */
export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "w-full rounded-xl border border-input-line bg-input-bg px-4 py-3.5",
        "text-[14px] font-medium text-fg outline-none transition-all duration-300 ease-smooth",
        "placeholder:text-muted/70",
        "focus:border-accent focus:bg-[rgba(2,2,5,0.85)] focus:shadow-[0_0_0_3px_var(--accent-red-glow)]",
        "lt:focus:bg-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

export function HelpText({ children }: { children: React.ReactNode }) {
  return <span className="mt-2 block text-[11px] font-medium text-muted">{children}</span>;
}

/**
 * Rounded package selector. The original drove this off `:has()` on a
 * hidden checkbox; here the checked state is a prop, which behaves the
 * same and works without the pseudo-class.
 */
export function PackageToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px]",
        "px-[18px] py-2 text-[11.5px] font-bold transition-all duration-300 ease-smooth select-none",
        "active:scale-[0.96] active:duration-100",
        checked
          ? [
              "border-[#4a4e91] bg-[linear-gradient(to_bottom,#1b1c3f,#4a4e91)] text-white",
              "shadow-[0_0_15px_rgba(74,78,145,0.35)]",
              "hover:scale-[1.08] hover:border-[#5b67b7]",
              "hover:bg-[linear-gradient(to_bottom,#2c2f63,#5b67b7)]",
              "hover:shadow-[0_0_20px_rgba(91,103,183,0.45)]",
            ]
          : [
              "border-white/8 bg-white/2 text-white/65",
              "hover:scale-[1.05] hover:border-white/20 hover:bg-white/5 hover:text-white",
              "lt:text-slate-500 lt:hover:text-slate-900",
            ],
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "relative inline-block size-3.5 shrink-0 rounded-full border transition-all duration-250",
          checked
            ? [
                "border-transparent shadow-[0_0_8px_rgba(0,221,235,0.5)]",
                "bg-[linear-gradient(144deg,#af40ff,#5b42f3_50%,#00ddeb)]",
                "after:absolute after:top-[2px] after:left-[4.5px] after:block after:h-[5px] after:w-[2.5px]",
                "after:rotate-45 after:border-white after:[border-width:0_1.5px_1.5px_0] after:content-['']",
              ]
            : "border-white/15 bg-white/10",
        )}
      />
      <span>{label}</span>
    </label>
  );
}

/** License package tile in the generator. */
export function PackageCard({
  name,
  description,
  selected,
  disabled,
  onSelect,
}: {
  name: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? "Not included in your permissions" : undefined}
      className={cn(
        "glow-ring relative rounded-[14px] border px-3.5 py-[18px] text-center",
        "transition-all duration-300 ease-smooth",
        disabled && "cursor-not-allowed opacity-35",
        !disabled && "cursor-pointer",
        selected
          ? [
              "glow-ring-on -translate-y-1 scale-[1.02] border-accent",
              "bg-[rgba(255,31,90,0.05)] shadow-[0_10px_20px_var(--accent-red-glow)]",
            ]
          : [
              "border-line bg-white/1",
              !disabled && "hover:glow-ring-on hover:-translate-y-1 hover:border-white/15 hover:bg-white/3",
            ],
      )}
    >
      <h4 className="mb-1 text-[13px] font-bold text-fg">{name}</h4>
      <p className="text-[11px] font-medium text-muted">{description}</p>
    </button>
  );
}
