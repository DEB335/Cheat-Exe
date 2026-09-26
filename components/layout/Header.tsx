"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { setBackgroundMusicMuted } from "@/components/effects/BackgroundVideo";
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
import { PAGE_TITLES, SEARCH_ITEMS } from "@/lib/nav";
import { UID_BYPASS_PACKAGE, canManageWhitelist } from "@/lib/packages";
import { useDashboard, useMyPackages } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { cn, formatStampForDisplay } from "@/lib/utils";


export function Header({ pathname, onOpenMobile }: { pathname: string; onOpenMobile: () => void }) {
  const user = useDashboard((s) => s.user);
  const page = PAGE_TITLES[pathname] ?? { title: "Overview", section: "DASHBOARD" };

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

      <div className="min-w-0 lg:self-start lg:pt-[7px]">
        <div className="mb-1 truncate text-[11px] leading-none font-extrabold tracking-[2px] text-[#9dbcf0] uppercase lg:mb-px lg:text-[13px] lg:tracking-[2.7px] lt:text-[#3b5b9a]">
          {page.section}
        </div>
        <h1 className="truncate font-display text-[24px] leading-[1.1] font-extrabold text-fg [text-shadow:0_2px_14px_rgba(0,0,0,0.45)] sm:text-[30px] lg:text-[34px] lg:leading-[1.05] xl:text-[42px] lt:[text-shadow:none]">
          {title}
        </h1>
      </div>

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
