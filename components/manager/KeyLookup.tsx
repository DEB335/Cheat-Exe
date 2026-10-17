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
    <NeonInset rim="danger">
      <label
        htmlFor={id}
        className="mb-3 block text-[13px] font-extrabold tracking-[1.2px] text-[#ff8ba7] uppercase lt:text-rose-700"
      >
        Enter license key
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="group/key relative min-w-0 flex-1">
          <NeonInput
            id={id}
            tone="red"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onLookup()}
            placeholder="Enter license key"
            boxClassName="h-[58px] sm:h-[62px]"
            inputClassName="px-5 text-[16px] sm:text-[17px]"
          />
        </div>
        <NeonButton
          tone="red"
          variant="filled"
          size="md"
          icon={<SearchIcon strokeWidth={2} />}
          loading={checking}
          disabled={disabled}
          onClick={onLookup}
          className="h-[58px] shrink-0 rounded-full px-8 text-[16px] font-black uppercase tracking-wider text-white [background:linear-gradient(90deg,#ff0037_0%,#e60032_50%,#cc002c_100%)] shadow-[0_0_24px_rgba(255,0,55,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-110 active:scale-[0.98] sm:h-[62px] sm:min-w-[170px] [&_svg]:size-5 border-none"
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
