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
        "relative z-10 min-h-[240px] overflow-hidden rounded-[18px] border border-white/10 bg-transparent",
        className,
      )}
    >

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
