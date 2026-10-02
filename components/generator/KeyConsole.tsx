import { cn } from "@/lib/utils";

import styles from "./scene-generator-console.module.css";

type LineKind = "request" | "error" | "output";

const LINE_TONES: Record<LineKind, string> = {
  request: "text-[#8fe9ff] lt:text-cyan-700",
  error: "text-[#ff8aa0] lt:text-rose-600",
  output: "text-[#4df0a0] lt:text-emerald-700",
};

/**
 * Colours each line by the prefix the generator wrote it with -- "> "
 * for the request, "[ERROR]" for a refusal -- and lets the lines after
 * one (the pretty-printed JSON under "[SUCCESS]", a message that ran
 * over a line) keep its colour. Nothing is added to or taken from the
 * text itself: Copy All still copies exactly what the page logged.
 */
function classify(lines: string[]): LineKind[] {
  let kind: LineKind = "output";
  return lines.map((line) => {
    if (line.startsWith(">")) kind = "request";
    else if (line.startsWith("[ERROR]")) kind = "error";
    else if (line.startsWith("[SUCCESS]")) kind = "output";
    return kind;
  });
}

/**
 * The generator's response log as a code well: line numbers in a gutter,
 * monospace lines, a caret blinking after the last one.
 *
 * The well is sized by its parent (flex-1 in the Generated Keys panel)
 * and the text scrolls inside it, so a batch of a hundred keys' JSON
 * never stretches the page.
 */
export function KeyConsole({ text, className }: { text: string; className?: string }) {
  // The request line is logged with a leading newline, a gap left over
  // from when the log was appended to an older one. In a numbered gutter
  // it would open every run with an empty line 1, so it is skipped here.
  const lines = text.replace(/^\n+/, "").split("\n");
  const kinds = classify(lines);

  return (
    <div
      className={cn(
        "relative z-10 min-h-[240px] overflow-hidden rounded-[18px]",
        "[background:linear-gradient(rgba(99,102,241,0.07)_1px,transparent_1px)_0_0/28px_28px,linear-gradient(90deg,rgba(99,102,241,0.07)_1px,transparent_1px)_0_0/28px_28px,linear-gradient(180deg,rgba(2,4,16,0.96),rgba(4,6,24,0.94))]",
        "shadow-[0_0_16px_-5px_rgba(99,102,241,0.36),0_0_24px_-10px_rgba(34,211,238,0.32),inset_0_0_40px_rgba(0,0,0,0.7)]",
        "lt:[background:#f8fafc] lt:shadow-[inset_0_1px_3px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      {/* The rim: cyan where the light comes in, through blue and indigo
          to magenta, hot white at the two lit corners. */}
      <span
        aria-hidden
        className="glass-edge z-[1] [--glass-edge:1.5px] [background:radial-gradient(18%_30%_at_100%_0%,rgba(255,255,255,0.95),transparent_70%),radial-gradient(18%_30%_at_0%_100%,rgba(236,254,255,0.85),transparent_70%),linear-gradient(125deg,#22d3ee_0%,#3b82f6_32%,#6366f1_58%,#c026d3_86%,#f0abfc_100%)] lt:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-12 border-r border-[rgba(129,140,248,0.16)] bg-white/[0.015] lt:border-slate-200 lt:bg-slate-100"
      />

      <div className="absolute inset-0 overflow-y-auto py-5 font-mono text-[15.5px] leading-[1.75]">
        {lines.map((line, i) => {
          const last = i === lines.length - 1;
          return (
            <div key={i} className="grid grid-cols-[3rem_minmax(0,1fr)]">
              <span
                aria-hidden
                className="pr-3 text-right text-[14px] text-[#94a3d8] tabular-nums select-none lt:text-slate-400"
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "pr-5 pl-4 font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]",
                  LINE_TONES[kinds[i]],
                )}
              >
                {line}
                {last ? (
                  <span
                    aria-hidden
                    className={`${styles.caret} ml-1 inline-block h-[1.1em] w-[2px] bg-current align-[-0.2em] shadow-[0_0_5px_color-mix(in_srgb,currentColor_45%,transparent)] lt:shadow-none`}
                  />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
