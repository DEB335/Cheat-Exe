import { PackageIcon, packageTone, toneVars } from "@/components/neon";
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
 * The grant list as a row of package chips, each in its own colour and
 * glyph: lit and filled when granted, a dim outline when not.
 *
 * Each chip is a real checkbox under a label, so Tab and Space work and
 * a screen reader hears "checked" -- the colour is only the look of it.
 * `size` "md" is the create form's row; "sm" fits the Perms modal.
 *
 * The md row spreads its chips across the panel like the mockup, as
 * equal grid tracks, whatever the provider's package count. Phones keep
 * content-width chips that wrap: two equal tracks would cut the longer
 * names.
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
        "flex flex-wrap gap-2.5 sm:gap-3",
        size === "md" && "sm:grid sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]",
        className,
      )}
    >
      {names.map((name) => {
        const on = selected.includes(name);
        return (
          <label
            key={name}
            title={name}
            style={toneVars(packageTone(name))}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center border font-bold tracking-[0.6px] whitespace-nowrap uppercase select-none",
              size === "md"
                ? "h-11 min-w-0 justify-center gap-2.5 rounded-[12px] px-4 text-[13.5px]"
                : "h-9 gap-2 rounded-[10px] px-3 text-[12px]",
              "transition-[translate,scale,background-color,border-color,box-shadow,color] duration-200 ease-smooth",
              "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] active:duration-75",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--tone-hi))]",
              on
                ? [
                    "border-[rgba(var(--tone-hi),0.85)] text-white",
                    "[background:linear-gradient(180deg,rgba(var(--tone),0.44),rgba(var(--tone),0.14))]",
                    "shadow-[0_0_18px_-4px_rgba(var(--tone),0.9),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_14px_rgba(var(--tone),0.24)]",
                    "hover:shadow-[0_0_24px_-3px_rgba(var(--tone),1),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_16px_rgba(var(--tone),0.3)]",
                    "lt:border-[rgb(var(--tone))] lt:[background:rgba(var(--tone),0.14)] lt:text-[var(--tone-lt)] lt:shadow-none",
                    "lt:hover:shadow-[0_4px_12px_-4px_rgba(var(--tone),0.55)]",
                  ]
                : [
                    "border-[rgba(var(--tone),0.3)] bg-[rgba(8,11,36,0.55)] text-[#8f9bc4]",
                    "hover:border-[rgba(var(--tone),0.7)] hover:bg-[rgba(var(--tone),0.08)] hover:text-white",
                    "lt:border-slate-300 lt:bg-white lt:text-slate-500",
                    "lt:hover:border-[rgba(var(--tone),0.6)] lt:hover:bg-[rgba(var(--tone),0.05)] lt:hover:text-slate-900",
                  ],
            )}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(event) => onToggle(name, event.target.checked)}
              className="sr-only"
            />
            <PackageIcon
              name={name}
              className={cn(
                "shrink-0",
                size === "md" ? "size-[18px]" : "size-[15px]",
                on
                  ? "text-[rgb(var(--tone-hi))] drop-shadow-[0_0_6px_rgba(var(--tone),0.95)] lt:text-[var(--tone-lt)] lt:drop-shadow-none"
                  : "text-[rgba(var(--tone-hi),0.5)] lt:text-[rgba(var(--tone),0.55)]",
              )}
            />
            {/* Truncates only for a name longer than any grid track
                -- one the provider added since. The label still reads
                in full to a screen reader, and on hover. */}
            <span className="truncate">{name}</span>
          </label>
        );
      })}
    </div>
  );
}
