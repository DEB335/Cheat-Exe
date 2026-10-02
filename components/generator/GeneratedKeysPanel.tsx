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
    <NeonPanel rim="blue" className="flex flex-col">
      <PanelHeader
        className="relative z-10"
        icon={<LinkIcon />}
        iconTone="blue"
        iconTone2="cyan"
        title="Generated Keys"
        subtitle="API response appears here."
        actions={
          <NeonButton
            tone="violet"
            size="md"
            trailingIcon={<CopyIcon />}
            onClick={() => onCopy(consoleText, "Copied to clipboard!")}
          >
            Copy All
          </NeonButton>
        }
      />

      <KeyConsole text={consoleText} className="flex-1 xl:min-h-[250px]" />

      {keys.length > 0 ? (
        <div className="relative z-10 mt-5 rounded-[16px] border border-[rgba(52,211,120,0.42)] p-4 [background:linear-gradient(180deg,rgba(52,211,120,0.11),rgba(52,211,120,0.03)),rgba(3,6,22,0.7)] shadow-[0_0_13px_-5px_rgba(52,211,120,0.38),inset_0_1px_0_rgba(255,255,255,0.05)] lt:border-emerald-200 lt:[background:#f0fdf4] lt:shadow-none">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12px] font-extrabold tracking-[1.2px] text-[#6ef3a5] uppercase lt:text-emerald-700">
              {keys.length} key{keys.length === 1 ? "" : "s"}
            </span>
            {/* shrink-0: the key list beside it used to take the whole row
                and push this button out through the side of the card. */}
            <NeonButton
              tone="green"
              size="xs"
              icon={<CopyIcon />}
              className="shrink-0"
              onClick={() => onCopy(keys.join("\n"), "Key copied to clipboard!")}
            >
              Copy all
            </NeonButton>
          </div>

          {/* One row per key, and capped so a batch of 100 scrolls inside
              the card instead of stretching the whole page. The old
              markup put keys.join("\n") in a plain span, where the
              newlines collapsed to spaces and break-all then chopped
              each key across lines mid-token. */}
          <ul className="max-h-[168px] space-y-0.5 overflow-y-auto pr-1">
            {keys.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-[8px] pl-2 transition-colors duration-200 hover:bg-[rgba(52,211,120,0.08)] lt:hover:bg-emerald-100/60"
              >
                <span className="truncate font-mono text-[14px] font-semibold text-[#6ef3a5] lt:text-emerald-700">
                  {key}
                </span>
                <NeonButton
                  variant="ghost"
                  tone="green"
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
      ) : (
        // Phones get no hologram: the panel sits under the form there,
        // and the console is what the page is for.
        <div className="relative mt-5 hidden min-h-[240px] flex-1 sm:block xl:min-h-[290px]">
          <KeygenScene className="absolute inset-x-0 top-0 -bottom-4" />
        </div>
      )}
    </NeonPanel>
  );
}
