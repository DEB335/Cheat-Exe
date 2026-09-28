"use client";

import { useId } from "react";

import { SearchIcon } from "@/components/icons";
import { NeonButton, NeonInput, NeonInset, XCircleIcon } from "@/components/neon";

/**
 * The "Enter license key" well: the key field with its line of light
 * underneath, the Lookup button, and whatever the lookup found (or the
 * API's not-found message) below them. State lives in the page; this
 * only draws it.
 */
export function KeyLookup({
  value,
  onChange,
  onLookup,
  disabled,
  checking,
  notFound,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onLookup: () => void;
  /** Any request (lookup or action) is in flight. */
  disabled: boolean;
  /** The lookup itself is the request in flight. */
  checking: boolean;
  notFound: string | null;
  /** The key info rows, once a lookup succeeds. */
  children?: React.ReactNode;
}) {
  const id = useId();

  return (
    <NeonInset rim="violet">
      <label
        htmlFor={id}
        className="mb-3 block text-[13px] font-extrabold tracking-[1.2px] text-[#a98bff] uppercase lt:text-violet-700"
      >
        Enter license key
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="group/key relative min-w-0 flex-1">
          <NeonInput
            id={id}
            tone="violet"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onLookup()}
            placeholder="Enter license key"
            boxClassName="h-[58px] sm:h-[62px]"
            inputClassName="px-5 text-[16px] sm:text-[17px]"
          />
          {/* The line of light under the field: white-hot at its centre,
              violet into blue either side, with a flare beneath. It burns
              brighter while the field has focus. Sits outside the field's
              box, which clips its own overflow. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-[14%] -bottom-px h-[2px] bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.95)_32%,rgba(255,255,255,0.95)_50%,rgba(96,165,250,0.95)_68%,transparent)] opacity-90 transition-opacity duration-300 group-focus-within/key:opacity-100 lt:opacity-40 lt:group-focus-within/key:opacity-70"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-[36%] -bottom-2 h-4 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(139,92,246,0.8),transparent)] opacity-80 blur-[8px] transition-opacity duration-300 group-focus-within/key:opacity-100 lt:hidden"
          />
        </div>
        <NeonButton
          tone="violet"
          variant="filled"
          size="md"
          icon={<SearchIcon strokeWidth={2} />}
          loading={checking}
          disabled={disabled}
          onClick={onLookup}
          // Bolder and bluer than the kit's filled violet, as the mockup's
          // Lookup is. The kit's pale light-theme fill reads as disabled
          // beside the field, so the light theme gets a solid one too.
          className="h-[58px] shrink-0 px-7 text-[17px] font-bold [background:linear-gradient(135deg,rgba(139,92,246,0.7),rgba(59,130,246,0.45))] shadow-[0_0_26px_-4px_rgba(99,102,241,0.9),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_0_14px_rgba(139,92,246,0.35)] hover:[background:linear-gradient(135deg,rgba(139,92,246,0.88),rgba(59,130,246,0.62))] hover:shadow-[0_0_34px_-2px_rgba(99,102,241,1),inset_0_1px_0_rgba(255,255,255,0.36),inset_0_0_16px_rgba(139,92,246,0.4)] sm:h-[62px] sm:min-w-[170px] sm:text-[18px] lt:text-white lt:[background:linear-gradient(135deg,#8b5cf6,#6366f1)] lt:shadow-[0_8px_18px_-8px_rgba(99,102,241,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] lt:hover:text-white lt:hover:[background:linear-gradient(135deg,#7c3aed,#4f46e5)] lt:hover:shadow-[0_10px_22px_-8px_rgba(99,102,241,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] [&_svg]:size-5"
        >
          {checking ? "Checking..." : "Lookup"}
        </NeonButton>
      </div>

      {notFound && (
        <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-[rgba(255,45,85,0.35)] bg-[rgba(255,45,85,0.1)] px-4 py-3 text-[13.5px] font-semibold text-[#ff8a9e] lt:border-red-200 lt:bg-red-50 lt:text-red-600">
          <XCircleIcon aria-hidden className="size-5 shrink-0" />
          {notFound}
        </div>
      )}

      {children}
    </NeonInset>
  );
}
