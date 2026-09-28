"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowRightIcon, DiscordIcon, LogOutIcon, UserIcon } from "@/components/icons";
import { CrownIcon, EditIcon, NeonButton, NeonChip, NeonPanel, PackageIcon, packageTone } from "@/components/neon";
import { ProfileAvatarStage } from "@/components/scenes/ProfileScenes";
import { shortPackageLabel } from "@/lib/packages";
import { formatExpiry } from "@/lib/reseller";
import type { PublicDatabase, ResellerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const DISCORD = "https://discord.gg/Rt6FWbW8HD";

type OwnRecord = PublicDatabase["cheatExeUsers"][string];

/**
 * The left-hand card: banner and avatar hologram, name and role, the
 * account's facts, then Discord and Logout.
 *
 * Every row is real. The owner account stores no creation date or
 * validity, so it gets Role and Tier only; a reseller also sees their
 * panels and when their access ends, off the record /api/db refreshes.
 */
export function ProfileCard({
  isOwner,
  name,
  avatar,
  banner,
  own,
  left,
  status,
  onEditAvatar,
  onLogout,
}: {
  isOwner: boolean;
  name: string;
  avatar: string;
  banner: string;
  own: OwnRecord | undefined;
  /** Days of access left, or null when the account never expires. */
  left: number | null;
  status: ResellerStatus | null;
  /** Jumps to the avatar field. Only passed when that field is editable. */
  onEditAvatar?: () => void;
  onLogout: () => void;
}) {
  const role = isOwner ? "Account Owner" : "Reseller";
  const roleIcon = isOwner ? <CrownIcon /> : <UserIcon />;

  return (
    <NeonPanel rim="aurora" className="flex flex-col p-3.5 sm:p-4 xl:p-4">
      {/* The warm glow the mockup pools along the card's lower edge,
          under the buttons. Painted first so the content sits over it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 rounded-b-[24px] bg-[radial-gradient(60%_90%_at_50%_100%,rgba(255,112,67,0.14),rgba(255,61,154,0.06)_45%,transparent_75%)] lt:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[14%] -bottom-px h-[2px] rounded-full bg-[linear-gradient(90deg,transparent,#ff8a4c_28%,#ff3d9a_72%,transparent)] opacity-60 shadow-[0_0_10px_1px_rgba(255,112,67,0.3),0_0_24px_4px_rgba(255,61,154,0.12)] lt:opacity-40"
      />

      <div className="relative flex flex-1 flex-col gap-4">
        {/* When the details panel beside it is taller, the spare height
            goes to this hero, as in the mockup, so the buttons stay
            snug under the facts instead of drifting to the floor. */}
        <div
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[18px] px-3 pt-2 pb-5 text-center",
            "border border-[rgba(167,139,250,0.35)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_-10px_rgba(168,85,247,0.8)]",
            "lt:border-violet-200 lt:shadow-none",
          )}
        >
          {/* Keyed on the address, so a new URL gets a fresh try. */}
          <Banner key={banner} src={banner} />

          {onEditAvatar ? (
            <NeonButton
              tone="violet"
              aria-label="Edit avatar image URL"
              title="Edit avatar image URL"
              icon={<EditIcon />}
              onClick={onEditAvatar}
              className="absolute top-3 right-3 z-[2]"
            />
          ) : null}

          <ProfileAvatarStage
            src={avatar}
            crown={isOwner}
            className="relative mx-auto h-[230px] w-full max-w-[320px]"
          />

          {/* Pulled up into the empty strip the fitted stage leaves under
              its pedestal, so the name sits right below the disc. The
              stage takes no pointer events, so nothing is covered. */}
          <h2 className="relative -mt-4 w-full truncate font-display text-[22px] leading-tight font-bold text-white lt:text-slate-900">
            {name}
          </h2>
          <NeonChip tone={isOwner ? "violet" : "blue"} shape="pill" caps={false} icon={roleIcon} className="relative mt-2.5">
            {role}
          </NeonChip>
        </div>

        <div
          className={cn(
            "flex flex-col gap-3.5 rounded-[16px] border border-[rgba(129,140,248,0.22)] bg-[rgba(4,6,26,0.5)] px-4 py-4",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lt:border-slate-200 lt:bg-slate-50/80 lt:shadow-none",
          )}
        >
          <MetaRow label="Role">
            <NeonChip tone={isOwner ? "violet" : "blue"} size="xs" shape="pill" caps={false} icon={roleIcon}>
              {role}
            </NeonChip>
          </MetaRow>
          {/* No creation date is stored for the owner account, only for
              resellers (`own.created`) -- omit rather than invent one. */}
          {own?.created && (
            <MetaRow label="Joined">
              <span className="font-bold text-fg">{own.created}</span>
            </MetaRow>
          )}
          <MetaRow label="Subscription Tier">
            <span className="flex items-center gap-1.5 font-extrabold text-green">
              {isOwner && <CrownIcon aria-hidden className="size-3.5" />}
              {isOwner ? "Owner" : "Paid"}
            </span>
          </MetaRow>

          {!isOwner && own && (
            <>
              {/* Straight off `own`, the record /api/db refreshes -- so a
                  panel the owner grants or revokes shows up here on the
                  next ping rather than at the next sign-in. */}
              <MetaRow label="Panels">
                <div className="flex max-w-[190px] flex-wrap justify-end gap-1">
                  {own.packages.length > 0 ? (
                    own.packages.map((pkg) => (
                      <NeonChip key={pkg} tone={packageTone(pkg)} size="xs" icon={<PackageIcon name={pkg} />}>
                        {shortPackageLabel(pkg)}
                      </NeonChip>
                    ))
                  ) : (
                    <NeonChip tone="slate" size="xs">
                      None
                    </NeonChip>
                  )}
                </div>
              </MetaRow>

              <MetaRow label="Valid Until">
                <span
                  className={cn(
                    "font-extrabold",
                    left === null
                      ? "text-green"
                      : left <= 0
                        ? "text-[#ef4444]"
                        : left <= 7
                          ? "text-orange"
                          : "text-fg",
                  )}
                >
                  {left === null ? "No end date" : formatExpiry(own)}
                </span>
              </MetaRow>

              {left !== null && (
                <MetaRow label="Days Remaining">
                  <NeonChip tone={left <= 0 ? "red" : left <= 7 ? "amber" : "green"} size="xs" caps={false}>
                    {left <= 0 ? "EXPIRED" : `${left} day${left === 1 ? "" : "s"} left`}
                  </NeonChip>
                </MetaRow>
              )}
            </>
          )}
        </div>

        {!isOwner && own && status === "EXPIRED" && (
          <p className="rounded-[12px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#fca5a5] lt:text-rose-700">
            Your access has ended. Ask the owner to renew it.
          </p>
        )}

        <button
          type="button"
          onClick={() => window.open(DISCORD, "_blank", "noopener,noreferrer")}
          className={cn(
            "group relative isolate flex h-14 w-full cursor-pointer items-center gap-3.5 overflow-hidden rounded-[14px] px-3.5",
            "border border-[rgba(24,119,242,0.85)] bg-[linear-gradient(180deg,rgba(24,119,242,0.2),rgba(24,119,242,0.05))]",
            "text-[17px] font-semibold text-[#d6e6ff] outline-none",
            "shadow-[0_0_18px_-5px_rgba(24,119,242,0.85),inset_0_1px_0_rgba(255,255,255,0.12)]",
            // The text waits for the flood below to reach it before it
            // turns white; the lift and press answer at once.
            "[transition:color_300ms_ease-out_100ms,translate_300ms_ease-out,scale_150ms_ease-out,box-shadow_300ms_ease-out]",
            "hover:-translate-y-0.5 hover:text-white hover:shadow-[0_8px_24px_-6px_rgba(24,119,242,0.9)] active:translate-y-0 active:scale-[0.98]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60a5fa]",
            // Circle that expands via inset box-shadow to flood the button.
            "before:absolute before:inset-0 before:-left-[5em] before:z-[-1] before:m-auto",
            "before:block before:size-[20em] before:rounded-full before:transition-shadow before:duration-500 before:content-['']",
            "hover:before:shadow-[inset_0_0_0_10em_rgb(24,119,242)]",
            // `lt:` adds no specificity, so each hover colour needs its own
            // light pair or the dark one wins on hover.
            "lt:bg-[rgba(24,119,242,0.07)] lt:bg-none lt:text-[rgb(24,119,242)] lt:shadow-none",
            "lt:hover:text-white lt:hover:shadow-[0_6px_18px_-8px_rgba(24,119,242,0.6)]",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgb(24,119,242)] text-white shadow-[0_0_14px_rgba(24,119,242,0.8)] transition-colors duration-300 group-hover:bg-white group-hover:text-[rgb(24,119,242)] lt:shadow-none">
            <DiscordIcon className="size-[18px]" />
          </span>
          <span className="flex-1 text-left">Discord</span>
          <ArrowRightIcon
            aria-hidden
            className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
          />
        </button>

        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "group flex h-14 w-full cursor-pointer items-center gap-3.5 rounded-[14px] px-4 select-none",
            "border border-[#ff3d6e] bg-[linear-gradient(90deg,rgba(230,40,67,0.24),rgba(255,61,154,0.12))]",
            "text-[17px] font-semibold text-white",
            "shadow-[0_0_18px_-5px_rgba(255,45,85,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]",
            "transition-[translate,scale,background-color,box-shadow] duration-300",
            "hover:-translate-y-px hover:bg-[linear-gradient(90deg,rgba(230,40,67,0.4),rgba(255,61,154,0.22))]",
            "hover:shadow-[0_6px_24px_-4px_rgba(255,45,85,0.6)] active:translate-y-0 active:scale-[0.98]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b8b]",
            "lt:bg-[rgba(230,40,67,0.06)] lt:bg-none lt:text-rose-700 lt:shadow-none",
            "lt:hover:bg-[rgba(230,40,67,0.12)] lt:hover:bg-none lt:hover:shadow-[0_6px_18px_-8px_rgba(230,40,67,0.6)]",
          )}
        >
          <LogOutIcon aria-hidden className="size-5 shrink-0 text-[#ff6b8b] lt:text-rose-600" strokeWidth={2.5} />
          <span className="flex-1 text-left">Logout</span>
          <ArrowRightIcon
            aria-hidden
            className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
          />
        </button>
      </div>
    </NeonPanel>
  );
}

/**
 * The banner behind the avatar, darkened so the hologram and name
 * read over it. The neon wash is always underneath and the picture
 * fades in over it once it has decoded, so a slow load or a dead CDN
 * link (the URL is free text) never shows the browser's broken-image
 * glyph -- not even before hydration, when nothing is listening yet.
 */
function Banner({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // decode() settles however the load went, including a load that
  // finished (or failed) before React hydrated.
  useEffect(() => {
    let live = true;
    imgRef.current?.decode().then(
      () => live && setState("ready"),
      () => live && setState("failed"),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className={cn(
          "size-full",
          "[background:radial-gradient(70%_55%_at_18%_8%,rgba(255,61,242,0.34),transparent_70%),radial-gradient(70%_60%_at_88%_26%,rgba(59,130,246,0.34),transparent_70%),radial-gradient(90%_55%_at_50%_78%,rgba(255,122,61,0.22),transparent_70%),linear-gradient(165deg,#1b1250,#0a0a2e)]",
          "lt:[background:radial-gradient(70%_55%_at_18%_8%,rgba(236,72,153,0.16),transparent_70%),radial-gradient(70%_60%_at_88%_26%,rgba(59,130,246,0.16),transparent_70%),linear-gradient(165deg,#f5f0ff,#eef2ff)]",
        )}
      />
      {src && state !== "failed" && (
        // Remote GIFs from an arbitrary CDN -- next/image would need a
        // configured loader for no benefit.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className={cn(
            "absolute inset-0 size-full object-cover brightness-[0.55] saturate-[1.15] transition-opacity duration-500 lt:brightness-90",
            state === "ready" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {/* Fades the art into the well so the name below sits on calm ground. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,6,30,0.05)_0%,rgba(8,6,30,0.35)_55%,rgba(9,8,34,0.94)_100%)] lt:bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.45)_55%,rgba(255,255,255,0.96)_100%)]" />
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-[11px] font-extrabold tracking-[1px] text-[#a9b8e0] uppercase lt:text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}
