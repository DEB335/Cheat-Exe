import { CopyIcon, LinkIcon } from "@/components/icons";
import { NeonButton, NeonPanel, PanelHeader } from "@/components/neon";
import { KeygenScene } from "@/components/scenes/KeygenScene";

import { KeyConsole } from "./KeyConsole";

/**
 * The Key Generator's right-hand panel: the response log, and under it
 * either the keys the last run produced or, until there are any, the
 * key-cube hologram.
 *
 * The two share the space below the console on purpose. On desktop this
 * panel stretches to the height of the form beside it, and a keys list
 * added on top of the hologram would push both panels taller the moment
 * a batch arrives. Swapping one for the other keeps the page still: the
 * hologram's slot is held taller than the keys card can grow (its list
 * is capped), so even a batch of a hundred fits in the same space.
 *
 * Every copy goes through the page's `onCopy`, with the same text and the
 * same toast each button had before.
 */
export function GeneratedKeysPanel({
  consoleText,
  keys,
  onCopy,
}: {
  consoleText: string;
  keys: string[];
  onCopy: (text: string, message: string) => void;
}) {
  return (
    <NeonPanel rim="danger" className="flex flex-col">
      <PanelHeader
        className="relative z-10"
        title="Generated Keys"
        subtitle="API response appears here."
        actions={
          <NeonButton
            tone="red"
            size="md"
            trailingIcon={<CopyIcon />}
            onClick={() => onCopy(consoleText, "Copied to clipboard!")}
          >
            Copy All
          </NeonButton>
        }
      />

      <KeyConsole text={consoleText} className="flex-1 xl:min-h-[250px]" />

      {keys.length > 0 && (
        <div className="relative z-10 mt-5 rounded-[16px] border border-[rgba(255,45,90,0.35)] p-4 [background:linear-gradient(180deg,rgba(255,45,90,0.12),rgba(255,45,90,0.04)),rgba(24,4,11,0.7)] shadow-[0_0_16px_rgba(255,31,90,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl lt:border-rose-200 lt:[background:#fff1f2] lt:shadow-none">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12px] font-extrabold tracking-[1.2px] text-[#ff8ba7] uppercase lt:text-rose-700">
              {keys.length} key{keys.length === 1 ? "" : "s"}
            </span>
            <NeonButton
              tone="red"
              size="xs"
              icon={<CopyIcon />}
              className="shrink-0"
              onClick={() => onCopy(keys.join("\n"), "Key copied to clipboard!")}
            >
              Copy all
            </NeonButton>
          </div>

          <ul className="max-h-[168px] space-y-0.5 overflow-y-auto pr-1">
            {keys.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-[8px] pl-2 transition-colors duration-200 hover:bg-[rgba(255,45,90,0.12)] lt:hover:bg-rose-100/60"
              >
                <span className="truncate font-mono text-[14px] font-semibold text-[#ffb4c8] lt:text-rose-700">
                  {key}
                </span>
                <NeonButton
                  variant="ghost"
                  tone="red"
                  size="xs"
                  title="Copy this key"
                  aria-label="Copy this key"
                  icon={<CopyIcon />}
                  className="size-7"
                  onClick={() => onCopy(key, "Key copied to clipboard!")}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </NeonPanel>
  );
}
