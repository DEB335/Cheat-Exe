"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { setBackgroundMusicMuted } from "@/components/effects/BackgroundMusic";
import {
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  MusicIcon,
  MusicOffIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { api, del, patchJson } from "@/lib/client-api";
import { REACTIONS } from "@/lib/messages";
import { applyClearMine, applyReadAll, applyReaction } from "@/lib/optimistic";
import {
  PAGE_TITLES,
  SEARCH_ITEMS,
  type EyebrowTone,
  type PageTitle,
  type TitleGradient,
  type TitleIcon,
} from "@/lib/nav";
import { UID_BYPASS_PACKAGE, canManageWhitelist } from "@/lib/packages";
import { useDashboard, useMyPackages } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { cn, formatStampForDisplay } from "@/lib/utils";


export function Header({ pathname, onOpenMobile }: { pathname: string; onOpenMobile: () => void }) {
  const user = useDashboard((s) => s.user);
  const page: PageTitle = PAGE_TITLES[pathname] ?? { title: "Overview", section: "DASHBOARD" };

  const title =
    user?.role !== "OWNER" && pathname === "/reseller-history" ? "My Key History" : page.title;

  return (
    <header
      className={cn(
        // A grid rather than a row, so the subtitle can hang under the
        // title without dragging the search and the account controls down
        // with it: those stay centred on the title itself, as drawn.
        "relative z-[5] grid items-center gap-x-3 gap-y-1.5 px-4 pt-5 pb-3 sm:gap-x-4 sm:px-6 sm:pt-6",
        "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,auto)_minmax(180px,1fr)_auto]",
        "lg:grid-cols-[minmax(0,auto)_minmax(180px,1fr)_auto] lg:gap-x-6 lg:gap-y-0 lg:pt-7 lg:pr-[34px] lg:pb-0 lg:pl-14",
        // A fixed title column at full width keeps the search in the same
        // place on every page, whatever length the title happens to be.
        "2xl:grid-cols-[minmax(354px,auto)_minmax(180px,1fr)_auto]",
      )}
    >
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open navigation"
        className="shrink-0 rounded-xl border border-[#142346] bg-[#050f24] p-2 text-fg lg:hidden lt:border-line lt:bg-surface"
      >
        <MenuIcon className="size-5" />
      </button>

      <PageHeading page={page} title={title} />

      <div className="hidden min-w-0 justify-center md:flex">
        <QuickSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5 lg:gap-[17px]">
        <Notifications />
        <ProfileMenu />
      </div>

      {page.subtitle && (
        // Under the title on a phone and a tablet; across the title and
        // search columns once the menu button is gone, since the search
        // box never reaches down this far.
        <p className="col-[2/-1] text-[13px] leading-[1.3] font-medium text-[#8ab3e0] lg:col-[1/-2] lg:text-[14.5px] lt:text-muted">
          {page.subtitle}
        </p>
      )}
    </header>
  );
}

/* ---------------------------------------------------------------
   Page heading

   Eyebrow over title, as every page has always had. The redesign
   mockups dress some titles up -- a lit word, a coloured eyebrow, a
   glass emblem -- and lib/nav says which page gets what. A page that
   asks for none of it gets the original markup, class for class.
   --------------------------------------------------------------- */

const EYEBROW_TYPE =
  "text-[11px] leading-none font-extrabold tracking-[2px] text-[#9dbcf0] uppercase lg:text-[13px] lg:tracking-[2.7px] lt:text-[#3b5b9a]";
const EYEBROW = `mb-1 truncate lg:mb-px ${EYEBROW_TYPE}`;

const TITLE_TYPE =
  "font-display text-[24px] leading-[1.1] font-extrabold text-fg [text-shadow:0_2px_14px_rgba(0,0,0,0.45)] sm:text-[30px] lg:text-[34px] lg:leading-[1.05] xl:text-[42px] lt:[text-shadow:none]";
const TITLE = `truncate ${TITLE_TYPE}`;

/*
 * Room for a glow. Both lines truncate, and `truncate` clips whatever
 * is painted past the box -- a neon halo round the letters stopped dead
 * in a hard-edged rectangle. A lit line swaps overflow:hidden for
 * overflow:clip, which still ends the text in an ellipsis but lets the
 * paint run on past the edge by overflow-clip-margin.
 *
 * Safari has no overflow-clip-margin yet, so the line also gets real
 * padding to paint into, handed straight back as negative margin so
 * every letter stays exactly where it was. The stack holding the lines
 * is a flex column, where margins add up instead of collapsing, so the
 * sums hold: under the eyebrow, 4px of padding and a -3px margin leave
 * the 1px gap it always had on a desktop (4px and 0 leave the 4px below
 * lg), and the title's 8px in and 8px out cancel.
 */
const GLOW_CLIP = "overflow-clip text-ellipsis whitespace-nowrap [overflow-clip-margin:14px]";
const EYEBROW_LIT = `${GLOW_CLIP} -mx-2.5 -mt-1 mb-0 px-2.5 py-1 lg:-mx-4 lg:-mb-[3px] lg:px-4 ${EYEBROW_TYPE}`;
const TITLE_LIT = `${GLOW_CLIP} -mx-2.5 -my-2 px-2.5 py-2 lg:-mx-3 lg:px-3 ${TITLE_TYPE}`;

const EYEBROW_TONES: Record<EyebrowTone, string> = {
  violet:
    "text-[#b99dff] [text-shadow:0_1px_6px_rgba(0,0,0,0.5),0_0_10px_rgba(139,92,246,0.55)] lt:text-[#6d28d9] lt:[text-shadow:none]",
  cyan: "text-[#62e4ff] [text-shadow:0_1px_6px_rgba(0,0,0,0.5),0_0_10px_rgba(34,211,238,0.45)] lt:text-[#0e7490] lt:[text-shadow:none]",
  blue: "text-[#7fb2ff] [text-shadow:0_1px_6px_rgba(0,0,0,0.5),0_0_10px_rgba(59,130,246,0.5)] lt:text-[#1d4ed8] lt:[text-shadow:none]",
  // Violet running into blue, as "LICENSE GENERATOR" is drawn.
  indigo:
    "bg-linear-to-r from-[#c7a4ff] to-[#7f9dff] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(139,92,246,0.55)] lt:from-[#6d28d9] lt:to-[#1d4ed8] lt:drop-shadow-none",
};

/**
 * A lit run of title text. The ramp is mirrored and drawn twice as
 * wide as the word, so at rest the word shows its first half (a -> b -> c)
 * and hovering the heading slides it across to the reverse. That slide
 * is the only motion: a gradient that flowed forever would re-rasterise
 * the glyphs every frame on every page (see text-rgb-flow in
 * globals.css), whereas this runs once, for as long as it is pointed at.
 *
 * The glow is a filter rather than a text-shadow, because a text-shadow
 * paints over clipped-background text and muddies the gradient.
 */
const LIT_TEXT = [
  "bg-[linear-gradient(90deg,var(--ta),var(--tb)_25%,var(--tc)_50%,var(--tb)_75%,var(--ta))]",
  "bg-[length:200%_100%] bg-left bg-clip-text text-transparent [text-shadow:none]",
  "[filter:drop-shadow(0_2px_8px_rgba(0,0,0,0.45))_drop-shadow(0_0_11px_var(--tg))]",
  "transition-[background-position] duration-[1600ms] ease-smooth group-hover/title:bg-right",
  "lt:[filter:none]",
].join(" ");

/** Stops per ramp, with deeper ones for light mode where a pastel would wash out. */
const RAMPS: Record<TitleGradient, string> = {
  "cyan-violet-pink":
    "[--ta:#67e8f9] [--tb:#a78bfa] [--tc:#f58ad6] [--tg:rgba(167,139,250,0.5)] lt:[--ta:#0891b2] lt:[--tb:#7c3aed] lt:[--tc:#db2777]",
  "pink-violet-blue":
    "[--ta:#ff86d6] [--tb:#c4a1ff] [--tc:#9fd0ff] [--tg:rgba(196,161,255,0.45)] lt:[--ta:#db2777] lt:[--tb:#7c3aed] lt:[--tc:#2563eb]",
  "blue-violet":
    "[--ta:#5ea4ff] [--tb:#8b8dff] [--tc:#bb8cff] [--tg:rgba(99,102,241,0.55)] lt:[--ta:#2563eb] lt:[--tb:#4f46e5] lt:[--tc:#7c3aed]",
  "blue-magenta":
    "[--ta:#4f95ff] [--tb:#9a7bff] [--tc:#d06bff] [--tg:rgba(139,92,246,0.55)] lt:[--ta:#1d4ed8] lt:[--tb:#6d28d9] lt:[--tc:#a21caf]",
  "pink-violet":
    "[--ta:#ff7ad0] [--tb:#d38bff] [--tc:#a78bfa] [--tg:rgba(236,72,153,0.42)] lt:[--ta:#db2777] lt:[--tb:#9333ea] lt:[--tc:#7c3aed]",
};

function PageHeading({ page, title }: { page: PageTitle; title: string }) {
  // The runs were written for the page's own title. When the header
  // prints something else (a reseller's "My Key History"), fall back to
  // the plain text rather than light up words that are not there.
  const parts =
    page.parts && page.parts.map((part) => part.text).join("") === title ? page.parts : null;
  const lit = parts?.some((part) => part.gradient) ?? false;
  const litEyebrow = Boolean(page.eyebrowTone || page.eyebrowBar);

  // Nothing to dress up: the original markup, untouched.
  if (!parts && !litEyebrow && !page.icon && !page.underline) {
    return (
      <div className="min-w-0 lg:self-start lg:pt-[7px]">
        <div className={EYEBROW}>{page.section}</div>
        <h1 className={TITLE}>{title}</h1>
      </div>
    );
  }

  const eyebrow = (
    <div className={litEyebrow ? EYEBROW_LIT : EYEBROW}>
      {page.eyebrowBar && (
        // Hung out in the gutter on a desktop, so the eyebrow's first
        // letter still lines up with the title's, as drawn.
        <span
          aria-hidden
          className={cn(
            "mr-2.5 inline-block h-[0.8em] w-[3px] rounded-full align-[-0.05em] lg:-ml-[13px]",
            "bg-linear-to-b from-[#6fb1ff] to-[#8b5cf6] shadow-[0_0_8px_rgba(96,165,250,0.85)]",
            "lt:from-[#2563eb] lt:to-[#6d28d9] lt:shadow-none",
          )}
        />
      )}
      {page.eyebrowTone ? (
        <span className={EYEBROW_TONES[page.eyebrowTone]}>{page.section}</span>
      ) : (
        page.section
      )}
    </div>
  );

  const heading = (
    <h1 className={lit ? TITLE_LIT : TITLE}>
      {parts
        ? parts.map((part, i) =>
            part.gradient ? (
              <span key={i} className={`${LIT_TEXT} ${RAMPS[part.gradient]}`}>
                {part.text}
              </span>
            ) : (
              <Fragment key={i}>{part.text}</Fragment>
            ),
          )
        : title}
    </h1>
  );

  // The cog sits in the title line itself, with the eyebrow running on
  // above it, the way the Profile mockup sets it.
  if (page.icon === "gear") {
    return (
      <div className="group/title flex min-w-0 flex-col lg:self-start lg:pt-[7px]">
        {eyebrow}
        <div className="flex min-w-0 items-center gap-2.5 lg:gap-3">
          <TitleEmblem kind="gear" className="size-[30px] lg:size-[32px] xl:size-[38px]" />
          <div className="flex min-w-0 flex-col">{heading}</div>
        </div>
      </div>
    );
  }

  const stack = (
    <>
      {eyebrow}
      {page.underline ? (
        <div className="relative flex min-w-0 flex-col">
          {heading}
          <TitleUnderline />
        </div>
      ) : (
        heading
      )}
    </>
  );

  if (!page.icon) {
    return <div className="group/title flex min-w-0 flex-col lg:self-start lg:pt-[7px]">{stack}</div>;
  }

  // An emblem spanning eyebrow and title together. It is drawn a touch
  // taller than the pair and hands the difference back in negative
  // margin, so the row -- and the search and account controls centred
  // on it -- stays the height it is on every other page.
  return (
    <div className="group/title flex min-w-0 items-center gap-3 lg:gap-4 lg:self-start lg:pt-[7px]">
      <TitleEmblem kind={page.icon} className="size-10 lg:-my-px lg:size-[52px] xl:-my-[3px] xl:size-16" />
      <div className="flex min-w-0 flex-col">{stack}</div>
    </div>
  );
}

/**
 * The glowing hairline under a title, with a hot spot a third of the way
 * along. It runs just under the baseline, behind the letters, rather
 * than below the descenders: the announcement banner starts right where
 * the title ends, and a line of its own would either sit on the banner's
 * rim or push the header taller on this one page. Behind the text (z
 * below it, inside the header's stacking context) the g and y cross it
 * the way they would a real underline.
 */
function TitleUnderline() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[2px] -z-10 h-[2px] lg:bottom-[3px]">
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          "bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.9)_16%,#eadcff_32%,rgba(96,165,250,0.85)_62%,transparent)]",
          "[filter:drop-shadow(0_0_4px_rgba(167,139,250,0.9))]",
          "lt:bg-[linear-gradient(90deg,transparent,#7c3aed_16%,#6d28d9_32%,#2563eb_62%,transparent)] lt:[filter:none]",
        )}
      />
      <span className="absolute top-1/2 left-[24%] h-[7px] w-[38px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,#ffffff,rgba(167,139,250,0.7)_45%,transparent)] lt:hidden" />
    </span>
  );
}

/* ---------------------------------------------------------------
   Title emblems

   Small glass objects in the redesign's palette, drawn as inline SVG so
   they stay sharp at any zoom and cost nothing to keep on screen. There
   is only ever one header, so the gradient ids are fixed.
   --------------------------------------------------------------- */

const EMBLEM_GLOW: Record<TitleIcon, string> = {
  "key-cube":
    "[filter:drop-shadow(0_0_10px_rgba(192,38,211,0.45))_drop-shadow(0_4px_14px_rgba(59,130,246,0.35))] group-hover/title:[filter:drop-shadow(0_0_14px_rgba(217,70,239,0.65))_drop-shadow(0_4px_18px_rgba(59,130,246,0.5))]",
  "shield-key":
    "[filter:drop-shadow(0_0_10px_rgba(139,92,246,0.55))_drop-shadow(0_4px_14px_rgba(59,130,246,0.3))] group-hover/title:[filter:drop-shadow(0_0_14px_rgba(167,139,250,0.75))_drop-shadow(0_4px_18px_rgba(59,130,246,0.45))]",
  gear: "[filter:drop-shadow(0_0_8px_rgba(96,165,250,0.7))] group-hover/title:[filter:drop-shadow(0_0_12px_rgba(129,140,248,0.9))]",
};

function TitleEmblem({ kind, className }: { kind: TitleIcon; className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        // Not on a phone, where the title column is already narrow, nor on
        // a tablet, where the search box joins the row and would be the
        // one squeezed to make room for it.
        "relative hidden shrink-0 sm:block md:hidden lg:block",
        "transition-transform duration-500 ease-smooth group-hover/title:-translate-y-0.5 group-hover/title:scale-[1.05]",
        className,
      )}
    >
      {/* A soft pool of light behind the glass. Static: a gradient fill,
          nothing that repaints. */}
      <span className="absolute inset-[-22%] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.3),rgba(59,130,246,0.12)_55%,transparent)] lt:hidden" />
      <span
        className={cn(
          "relative block size-full transition-[filter] duration-500",
          EMBLEM_GLOW[kind],
          "lt:[filter:drop-shadow(0_3px_8px_rgba(79,70,229,0.28))] lt:group-hover/title:[filter:drop-shadow(0_3px_10px_rgba(79,70,229,0.4))]",
        )}
      >
        {kind === "key-cube" ? <KeyCubeArt /> : kind === "shield-key" ? <ShieldKeyArt /> : <GearArt />}
      </span>
    </span>
  );
}

/** Key Generator: a faceted glass cube with a neon key caught inside it. */
function KeyCubeArt() {
  const key = (
    <>
      <circle cx="23" cy="36" r="5.6" />
      <path d="M28.6 36H45M40 36v5M44 36v3.6" />
    </>
  );
  return (
    <svg viewBox="0 0 64 64" fill="none" className="size-full overflow-visible">
      <defs>
        <linearGradient id="page-title-cube-top" x1="10" y1="6" x2="54" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb8f2" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="page-title-cube-left" x1="9" y1="18" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d946ef" stopOpacity="0.85" />
          <stop offset="1" stopColor="#4c1d95" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="page-title-cube-right" x1="55" y1="18" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60a5fa" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1e2a78" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="page-title-cube-rim" x1="9" y1="5" x2="55" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff8ae6" />
          <stop offset="0.5" stopColor="#b69cff" />
          <stop offset="1" stopColor="#6fb1ff" />
        </linearGradient>
      </defs>

      {/* The pool of light it floats over. */}
      <ellipse cx="32" cy="60" rx="19" ry="2.8" fill="#8b5cf6" fillOpacity="0.5" />

      <path d="M32 5 55 17.5 32 30.5 9 17.5Z" fill="url(#page-title-cube-top)" />
      <path d="M9 17.5 32 30.5V58L9 45Z" fill="url(#page-title-cube-left)" />
      <path d="M55 17.5 32 30.5V58L55 45Z" fill="url(#page-title-cube-right)" />
      <path
        d="M9 17.5 32 30.5 55 17.5M32 30.5V58"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M32 5 55 17.5V45L32 58 9 45V17.5Z"
        stroke="url(#page-title-cube-rim)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Light catching the top edges. */}
      <path d="M13.5 17.8 30.5 8.6" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M36 8.8 50 16.4" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />

      <g transform="rotate(45 32 36)" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#ff4fd8" strokeOpacity="0.6" strokeWidth="5.6">
          {key}
        </g>
        <g stroke="#fff5fe" strokeWidth="2.4">
          {key}
        </g>
      </g>

      {/* A glint on the corner. */}
      <path d="M50 6.5 51.1 9.4 54 10.5 51.1 11.6 50 14.5 48.9 11.6 46 10.5 48.9 9.4Z" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  );
}

/** Manage Key and the key histories: a glass shield holding a lit key. */
function ShieldKeyArt() {
  const shield = "M32 5 53 12.5V29c0 14-9 24-21 30C20 53 11 43 11 29V12.5Z";
  const key = (
    <>
      <circle cx="24.5" cy="31.5" r="4.8" />
      <path d="M29.3 31.5H41.8M37.2 31.5v4.2M40.8 31.5v3.2" />
    </>
  );
  return (
    <svg viewBox="0 0 64 64" fill="none" className="size-full overflow-visible">
      <defs>
        <linearGradient id="page-title-shield-fill" x1="32" y1="5" x2="32" y2="59" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e2380" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0a0f35" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="page-title-shield-core" cx="32" cy="31" r="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="page-title-shield-sheen" x1="11" y1="5" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="page-title-shield-rim" x1="11" y1="5" x2="53" y2="59" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff7ae0" />
          <stop offset="0.5" stopColor="#9b7bff" />
          <stop offset="1" stopColor="#5fa8ff" />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="61" rx="15" ry="2.4" fill="#8b5cf6" fillOpacity="0.45" />

      <path d={shield} fill="url(#page-title-shield-fill)" />
      <path d={shield} fill="url(#page-title-shield-core)" />
      <path d={shield} fill="url(#page-title-shield-sheen)" />
      <path d={shield} stroke="url(#page-title-shield-rim)" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M32 10.5 48 16.3v13.1c0 11-6.9 19-16 23.9-9.1-4.9-16-12.9-16-23.9V16.3Z"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      <g transform="rotate(-45 32 32)" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#60a5fa" strokeOpacity="0.65" strokeWidth="5">
          {key}
        </g>
        <g stroke="#eef4ff" strokeWidth="2.2">
          {key}
        </g>
      </g>
    </svg>
  );
}

/** Profile: a lit cog. */
function GearArt() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="size-full overflow-visible">
      <defs>
        <linearGradient id="page-title-gear-body" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="0.5" stopColor="#6d7dff" />
          <stop offset="1" stopColor="#b26cff" />
        </linearGradient>
        <linearGradient id="page-title-gear-sheen" x1="10" y1="6" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={GEAR_PATH} fill="url(#page-title-gear-body)" />
      <path d={GEAR_PATH} fill="url(#page-title-gear-sheen)" />
      <path d={GEAR_PATH} stroke="#e0e7ff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="10" fill="#0b1238" stroke="#c7d2fe" strokeOpacity="0.7" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="4.2" fill="#8fb8ff" fillOpacity="0.55" />
    </svg>
  );
}

/** Eight teeth on a 27 / 21.5 radius pair, centred in a 64 box. */
const GEAR_PATH =
  "M26.8 11.14L28.01 5.3A27 27 0 0 1 35.99 5.3L37.2 11.14A21.5 21.5 0 0 1 43.07 13.57L48.06 10.3A27 27 0 0 1 53.7 15.94L50.43 20.93A21.5 21.5 0 0 1 52.86 26.8L58.7 28.01A27 27 0 0 1 58.7 35.99L52.86 37.2A21.5 21.5 0 0 1 50.43 43.07L53.7 48.06A27 27 0 0 1 48.06 53.7L43.07 50.43A21.5 21.5 0 0 1 37.2 52.86L35.99 58.7A27 27 0 0 1 28.01 58.7L26.8 52.86A21.5 21.5 0 0 1 20.93 50.43L15.94 53.7A27 27 0 0 1 10.3 48.06L13.57 43.07A21.5 21.5 0 0 1 11.14 37.2L5.3 35.99A27 27 0 0 1 5.3 28.01L11.14 26.8A21.5 21.5 0 0 1 13.57 20.93L10.3 15.94A27 27 0 0 1 15.94 10.3L20.93 13.57A21.5 21.5 0 0 1 26.8 11.14Z";

/** Nothing to subscribe to: the platform does not change under a page. */
const subscribeNever = () => () => {};

function isApplePlatform(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
}

/**
 * Which modifier the shortcut hint should name, or null until mounted.
 *
 * The server cannot know the visitor's platform, so it renders the chip
 * empty and the client fills it in straight after hydration -- the same
 * useSyncExternalStore pattern as lib/use-external, which is what keeps
 * React from calling the difference a mismatch.
 */
function useShortcutModifier(): "meta" | "ctrl" | null {
  return useSyncExternalStore(
    subscribeNever,
    () => (isApplePlatform() ? "meta" : "ctrl"),
    () => null,
  );
}

function QuickSearch() {
  const router = useRouter();
  const user = useDashboard((s) => s.user);
  const packages = useMyPackages();
  const modifier = useShortcutModifier();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter((item) => {
      if (item.ownerOnly && user?.role !== "OWNER") return false;
      // Otherwise search stays a way into a section the sidebar has
      // already taken away -- typing "uid" would still offer it.
      if (item.pkg === UID_BYPASS_PACKAGE && user) {
        if (!canManageWhitelist({ role: user.role, packages })) return false;
      }
      return item.name.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
    });
  }, [query, user, packages]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The chip promises Cmd/Ctrl+K, so the key has to do it -- from
  // anywhere on the page, including from inside another field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      // Below md the box is display:none and cannot take focus. Leave the
      // browser its own Ctrl+K there rather than swallow it for nothing.
      const input = inputRef.current;
      if (!input || input.getClientRects().length === 0) return;

      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    router.push(href);
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "glow-ring hover:glow-ring-fast relative z-10 flex w-full max-w-[354px] items-center rounded-full",
        "transition-all duration-300 ease-smooth",
      )}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 z-[2] size-[15px] -translate-y-1/2 text-[#b4cbf0] lg:left-[23px] lg:size-[18px] lt:text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search dashboard..."
        aria-label="Search dashboard"
        aria-keyshortcuts={modifier === null ? undefined : modifier === "meta" ? "Meta+K" : "Control+K"}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(event.target.value.trim().length > 0);
        }}
        onFocus={() => setOpen(query.trim().length > 0)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            event.currentTarget.blur();
          } else if (event.key === "Enter" && results[0]) {
            go(results[0].href);
          }
        }}
        className={cn(
          "h-10 w-full rounded-full border border-[#1a2b4f] bg-[#041129] pr-[72px] pl-10",
          "text-[13px] text-fg outline-none transition-all duration-300 ease-smooth",
          "placeholder:text-[#a9c0e2] focus:border-[#2c4478] focus:bg-[#061532]",
          "lg:h-[46px] lg:pr-[84px] lg:pl-[52px] lg:text-[15px]",
          "lt:border-input-line lt:bg-input-bg lt:placeholder:text-muted lt:focus:bg-white",
        )}
      />
      <kbd
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 z-[2] -translate-y-1/2 rounded-[9px]",
          "bg-[#111c38] px-2 py-[5px] font-sans text-[11px] leading-none font-medium whitespace-nowrap text-[#dce8ff] [word-spacing:2px]",
          "lg:right-[17px] lg:px-[9px] lg:py-[6px] lg:text-[12px]",
          "lt:bg-black/5 lt:text-muted",
          // Blank until the platform is known, so a Mac never flashes "Ctrl".
          modifier === null && "invisible",
        )}
      >
        {modifier === "meta" ? "⌘ K" : "Ctrl K"}
      </kbd>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-[1000] flex max-h-[250px] flex-col gap-1 overflow-y-auto rounded-2xl border border-line bg-[rgba(10,15,30,0.98)] p-1.5 shadow-[var(--card-shadow)] backdrop-blur-[20px] lt:bg-white">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-muted">No matches.</div>
          ) : (
            results.map((item) => (
              <button
                key={item.href + item.name}
                type="button"
                onClick={() => go(item.href)}
                className="rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                {item.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Notification centre: the owner's announcements, and the neon unread
 * marker that makes them impossible to miss.
 *
 * Opening the panel marks everything read, which is the same state the
 * banner's "Got it" writes -- one unread count, two ways to clear it.
 */
function Notifications() {
  const router = useRouter();
  const toast = useToast();
  const messages = useDashboard((s) => s.db.cheatExeMessages);
  const patch = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = messages.filter((m) => !m.read).length;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || unread === 0) return;

    // Clear the marker on the spot; the server catches up behind it.
    const snapshot = patch(applyReadAll);
    try {
      await patchJson("/api/messages", {});
    } catch {
      restore(snapshot);
    }
  };

  // Personal, not global: this hides the list for whoever clicked it and
  // leaves everybody else's untouched.
  const clearMine = async () => {
    const snapshot = patch(applyClearMine);
    setOpen(false);
    try {
      await del("/api/messages?scope=mine");
      toast("Notifications cleared.", "success");
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const react = async (id: string, reaction: string, mine: string | null) => {
    const snapshot = patch((db) => applyReaction(db, id, reaction));
    try {
      await patchJson(`/api/messages/${id}`, { reaction: mine === reaction ? null : reaction });
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `${unread} unread announcements` : "Announcements"}
        aria-expanded={open}
        className={cn(
          "glow-ring hover:glow-ring-fast relative flex size-10 cursor-pointer items-center justify-center rounded-xl border",
          "bg-[linear-gradient(160deg,#071431,#040d20)]",
          "transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-[#24396c] hover:text-fg",
          "lg:size-[52px] lg:rounded-[14px]",
          open ? "border-[#24396c] text-fg" : "border-[#132142] text-[#a9bde2]",
          // bg-none first: the dark gradient is a background-image, which a
          // background-color alone would leave painted on top.
          "lt:border-line lt:bg-none lt:bg-white lt:text-muted lt:hover:border-[#c7d2e6] lt:hover:text-fg",
        )}
      >
        <BellIcon className="size-5 lg:size-[23px]" strokeWidth={1.8} />

        {/* The unread marker: a lit dot, no number -- the count is in the
            label for screen readers, and on the Messages badge in the nav.
            Static on purpose; an idle pulse here would run on every page. */}
        {unread > 0 && (
          <span
            aria-hidden
            className={cn(
              "absolute top-[6px] right-[6px] size-2 rounded-full lg:top-[6px] lg:right-[7px] lg:size-[10px]",
              "bg-[radial-gradient(circle_at_42%_38%,#ffe4ec_0,#ff5c85_32%,#ff1f5a_68%)]",
              "shadow-[0_0_6px_rgba(255,31,90,0.9),0_0_14px_rgba(255,31,90,0.55)]",
            )}
          />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "animate-dropdown-fade absolute top-[calc(100%+10px)] right-0 z-[100] w-[min(340px,calc(100*var(--app-vw)-32px))]",
            "overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(10,15,30,0.9)]",
            "shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-[40px]",
            "lt:border-black/6 lt:bg-white/90",
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[10px] font-extrabold tracking-[1.2px] text-muted uppercase">
              Announcements
            </span>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMine}
                  title="Remove these from your list only"
                  className="cursor-pointer text-[11px] font-bold text-muted hover:text-[#ef4444]"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  router.push("/messages");
                  setOpen(false);
                }}
                className="cursor-pointer text-[11px] font-bold text-[#22d3ee] hover:underline"
              >
                View all
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted">Nothing yet.</p>
            ) : (
              messages.slice(0, 8).map((m) => (
                <div key={m.id} className="border-b border-line/60 px-4 py-3 last:border-b-0">
                  <div className="mb-1 flex items-center gap-2 text-[10.5px] text-muted">
                    <span className="font-bold text-fg">{m.by}</span>
                    <span>{formatStampForDisplay(m.at)}</span>
                  </div>
                  <p className="mb-2 text-[12.5px] leading-[1.5] break-words whitespace-pre-wrap text-fg">
                    {m.body}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {REACTIONS.map((r) => {
                      const count = m.reactionCounts[r] ?? 0;
                      const mine = m.myReaction === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => react(m.id, r, m.myReaction)}
                          className={cn(
                            "flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5",
                            "text-[11px] transition-colors",
                            mine
                              ? "border-[rgba(34,211,238,0.5)] bg-[rgba(34,211,238,0.15)] text-[#67e8f9]"
                              : "border-line bg-white/2 text-muted hover:bg-white/6",
                          )}
                        >
                          <span>{r}</span>
                          {count > 0 && <span className="font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const router = useRouter();
  const user = useDashboard((s) => s.user);
  const profile = useDashboard((s) => s.db.profile);
  const { light, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const name = user?.role === "OWNER" ? profile.displayName : (user?.username ?? "");
  const roleLabel = user?.role === "OWNER" ? "Account Owner" : "Reseller";

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div ref={ref} className="relative flex items-center gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className={cn(
          "glow-ring hover:glow-ring-slow flex h-10 cursor-pointer items-center gap-2 rounded-xl border py-1 pr-2 pl-1",
          "border-[#142548] bg-[linear-gradient(160deg,#071533,#040c1f)]",
          "transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-[#24396c]",
          "sm:gap-4 sm:pl-3.5 lg:h-16 lg:rounded-2xl lg:pr-[10px] lg:pl-[18px]",
          "lt:border-line lt:bg-none lt:bg-white lt:hover:border-[#c7d2e6]",
        )}
      >
        <div className="hidden min-w-0 flex-col items-start sm:flex">
          <span className="max-w-[160px] truncate text-[13px] leading-[1.25] font-extrabold text-fg lg:text-[14.5px]">
            {name}
          </span>
          <span className="mt-0.5 text-[11px] leading-[1.25] font-semibold text-[#aec3e6] lt:text-muted">
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-[9px]">
          <div className="size-8 shrink-0 overflow-hidden rounded-full border-2 border-[#cf2130] bg-black shadow-[0_0_10px_rgba(235,30,48,0.5),0_0_22px_rgba(235,30,48,0.18)] lg:size-[46px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatar} alt="" className="size-full object-cover" />
          </div>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-[#b5c8ea] transition-transform duration-300 ease-smooth lt:text-muted",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      {open && (
        <div
          className={cn(
            "animate-dropdown-fade absolute top-[calc(100%+10px)] right-0 z-[100] flex w-[220px] flex-col gap-1.5",
            "rounded-[20px] border border-white/8 bg-[rgba(10,15,30,0.75)] p-2.5",
            "shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-[40px]",
            "lt:border-black/6 lt:bg-white/80 lt:shadow-[0_10px_35px_rgba(0,0,0,0.1)]",
          )}
        >
          <div className="px-3.5 pt-2.5 pb-1.5 text-[10px] font-extrabold tracking-[1.2px] text-muted uppercase">
            My Account
          </div>

          <DropdownItem
            onClick={() => {
              router.push("/profile");
              setOpen(false);
            }}
          >
            <UserIcon className="size-4" />
            Profile Settings
          </DropdownItem>

          <DropdownItem
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setBackgroundMusicMuted(next);
            }}
          >
            {muted ? <MusicOffIcon className="size-4" /> : <MusicIcon className="size-4" />}
            {muted ? "Music Off" : "Music On"}
          </DropdownItem>

          {/* Restored: the original stylesheet ships a full light theme and
              a view-transition toggle, but no control ever reached it. */}
          <DropdownItem
            onClick={(event) => {
              toggle(event);
              setOpen(false);
            }}
          >
            {light ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
            {light ? "Dark Mode" : "Light Mode"}
          </DropdownItem>

          <div className="my-1.5 h-px bg-line" />

          <DropdownItem tone="danger" onClick={logout}>
            <LogOutIcon className="size-4" />
            Log Out
          </DropdownItem>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  children,
  tone = "default",
  onClick,
}: {
  children: React.ReactNode;
  tone?: "default" | "danger";
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-2.5",
        "text-left text-[13px] font-bold transition-all duration-200",
        tone === "danger"
          ? "text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#f87171]"
          : "text-muted hover:bg-white/4 hover:text-fg lt:hover:bg-black/4",
      )}
    >
      {children}
    </button>
  );
}
