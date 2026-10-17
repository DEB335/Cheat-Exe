import { CheckIcon } from "@/components/icons";
import { PackageIcon } from "@/components/neon";
import { cn } from "@/lib/utils";

/** Adds or removes one package from a grant list held in state. */
export function togglePackage(
  name: string,
  on: boolean,
  setter: (updater: (current: string[]) => string[]) => void,
) {
  setter((current) => (on ? [...current, name] : current.filter((p) => p !== name)));
}

/**
 * Package selection tiles matching the generator's package cards:
 * dark crimson glass base, pure white icons and typography,
 * subtle watermark icon on resting tiles, and glowing red border
 * with checkmark badge on selected tiles.
 */
export function PackageToggles({
  names,
  selected,
  onToggle,
  size = "md",
  className,
  ...aria
}: {
  names: string[];
  selected: string[];
  onToggle: (name: string, on: boolean) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <div
      role="group"
      {...aria}
      className={cn(
        "grid gap-2.5 sm:gap-3",
        size === "md"
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3",
        className,
      )}
    >
      {names.map((name) => {
        const on = selected.includes(name);
        const subtitle = name.toLowerCase().includes("package") ? name : `${name} Package`;

        return (
          <label
            key={name}
            title={name}
            className={cn(
              "group/tile relative flex min-w-0 cursor-pointer flex-col items-start border-[1.5px] select-none",
              "transition-[translate,scale,box-shadow,border-color] duration-300 ease-smooth",
              "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#ff0037]",
              size === "md"
                ? "min-h-[120px] rounded-[16px] px-3.5 pt-4 pb-3.5"
                : "min-h-[90px] rounded-[14px] px-3 pt-3 pb-2.5",
              on
                ? [
                    "[background:linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,0,55,0.35),rgba(255,0,55,0)_55%),linear-gradient(150deg,rgba(70,6,20,0.95)_0%,rgba(40,4,12,0.95)_52%,rgba(20,2,6,0.98)_100%)]",
                    "border-[#ff0037]",
                    "shadow-[0_0_20px_rgba(255,0,55,0.45),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_18px_rgba(255,0,55,0.2)]",
                    "lt:border-red-600 lt:[background:linear-gradient(150deg,rgba(255,230,235,0.95),rgba(255,255,255,0.95))]",
                  ]
                : [
                    "[background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,45,90,0.14),rgba(255,45,90,0)_55%),linear-gradient(150deg,rgba(28,4,12,0.85)_0%,rgba(18,2,8,0.9)_52%,rgba(12,2,5,0.95)_100%)] backdrop-blur-xl",
                    "border-[rgba(255,45,90,0.28)]",
                    "shadow-[0_0_10px_-4px_rgba(255,0,55,0.25),inset_0_1px_0_rgba(255,255,255,0.12)]",
                    "hover:border-[#ff2a55]",
                    "hover:shadow-[0_0_16px_rgba(255,0,55,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]",
                    "lt:border-rose-200 lt:bg-white lt:hover:border-rose-400",
                  ],
            )}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(event) => onToggle(name, event.target.checked)}
              className="sr-only"
            />

            {/* Top-left main icon (always pure white with soft glow) */}
            <PackageIcon
              name={name}
              className={cn(
                "shrink-0 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.35)]",
                "transition-transform duration-300 ease-smooth group-hover/tile:scale-110",
                size === "md" ? "mb-3 size-[26px]" : "mb-2 size-[20px]",
                "lt:text-slate-800 lt:drop-shadow-none",
              )}
            />

            {/* Top-right indicator: red checkmark badge when selected, faint white watermark icon when unselected */}
            {on ? (
              <span
                aria-hidden
                className={cn(
                  "absolute flex items-center justify-center rounded-full border border-white/90 text-white shadow-[0_0_10px_rgba(255,0,55,0.7)] [background:linear-gradient(135deg,#ff0037,#cc002c)]",
                  size === "md"
                    ? "top-2.5 right-2.5 size-[22px]"
                    : "top-2 right-2 size-[18px]",
                )}
              >
                <CheckIcon
                  className={size === "md" ? "size-3" : "size-2.5"}
                  strokeWidth={3.2}
                />
              </span>
            ) : (
              <PackageIcon
                name={name}
                className={cn(
                  "absolute text-white opacity-25 transition-all duration-300 group-hover/tile:opacity-50 group-hover/tile:scale-110",
                  size === "md" ? "top-3 right-3 size-4" : "top-2.5 right-2.5 size-3.5",
                  "lt:text-slate-400",
                )}
              />
            )}

            {/* Bottom typography: bold white title & subtitle */}
            <span className="mt-auto flex w-full flex-col">
              <span
                className={cn(
                  "font-display leading-tight font-bold break-words text-white uppercase tracking-wide [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] lt:text-slate-900 lt:[text-shadow:none]",
                  size === "md" ? "text-[13px]" : "text-[11.5px]",
                )}
              >
                {name}
              </span>
              <span
                className={cn(
                  "truncate font-medium transition-colors",
                  size === "md" ? "mt-0.5 text-[11.5px]" : "mt-0.5 text-[10px]",
                  on ? "text-white/90 lt:text-slate-600" : "text-white/70 lt:text-slate-500",
                )}
              >
                {subtitle}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
