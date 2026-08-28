"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { setBackgroundMusicMuted } from "@/components/effects/BackgroundVideo";
import {
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  MusicIcon,
  MessageIcon,
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
import { useDashboard } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { cn, formatStampForDisplay } from "@/lib/utils";


export function Header({ pathname, onOpenMobile }: { pathname: string; onOpenMobile: () => void }) {
  const user = useDashboard((s) => s.user);
  const page = PAGE_TITLES[pathname] ?? { title: "Overview", section: "DASHBOARD" };

  const title =
    user?.role !== "OWNER" && pathname === "/reseller-history" ? "My Key History" : page.title;

  return (
    <header className="relative z-[5] flex items-center justify-between gap-3 px-5 py-5 sm:gap-4 sm:px-6 sm:py-6 lg:px-10 lg:py-[30px]">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation"
          className="shrink-0 rounded-lg border border-line bg-surface p-2 text-fg lg:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
        <div className="min-w-0">
          <div className="mb-1.5 truncate text-[11px] font-extrabold tracking-[1.8px] text-muted uppercase">
            {page.section}
          </div>
          <h1 className="truncate font-display text-[19px] font-extrabold text-fg sm:text-[22px] lg:text-[26px]">
            {title}
          </h1>
        </div>
      </div>

      <QuickSearch />
      <div className="flex items-center gap-2.5">
        <Notifications />
        <ProfileMenu />
      </div>
    </header>
  );
}

function QuickSearch() {
  const router = useRouter();
  const user = useDashboard((s) => s.user);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter((item) => {
      if (item.ownerOnly && user?.role !== "OWNER") return false;
      return item.name.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
    });
  }, [query, user?.role]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "glow-ring hover:glow-ring-fast relative z-10 hidden items-center rounded-[10px]",
        "transition-all duration-300 ease-smooth md:flex",
        "xl:absolute xl:top-1/2 xl:left-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2",
      )}
    >
      <SearchIcon className="pointer-events-none absolute left-3 z-[2] size-[13px] -translate-y-1/2 top-1/2 text-muted" />
      <input
        type="text"
        value={query}
        placeholder="Search dashboard..."
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(event.target.value.trim().length > 0);
        }}
        onFocus={() => setOpen(query.trim().length > 0)}
        className={cn(
          // 140px cut the placeholder off mid-word on a 1024px screen.
          "w-[180px] rounded-[10px] border border-line bg-input-bg py-[7px] pr-3 pl-8",
          "text-[13px] text-fg outline-none transition-all duration-300 ease-smooth",
          "hover:w-[260px] focus:w-[260px] focus:border-white/15",
        )}
      />

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-[1000] flex max-h-[250px] flex-col gap-1 overflow-y-auto rounded-xl border border-line bg-[rgba(10,15,30,0.98)] p-1.5 shadow-[var(--card-shadow)] backdrop-blur-[20px] lt:bg-white">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-muted">No matches.</div>
          ) : (
            results.map((item) => (
              <button
                key={item.href + item.name}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  setQuery("");
                  setOpen(false);
                }}
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
        className={cn(
          "relative flex size-9 cursor-pointer items-center justify-center rounded-xl border",
          "transition-all duration-300 ease-smooth",
          unread > 0
            ? [
                "border-[rgba(34,211,238,0.45)] bg-[rgba(34,211,238,0.12)] text-[#22d3ee]",
                "shadow-[0_0_14px_rgba(34,211,238,0.35)]",
                "hover:bg-[rgba(34,211,238,0.2)]",
              ]
            : "border-line bg-surface text-muted hover:border-line-hover hover:text-fg",
        )}
      >
        <MessageIcon className="size-[18px]" />

        {/* The neon marker. Small on purpose -- it only has to catch the
            eye, and it sits clear of the icon's own glow. */}
        {unread > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center",
              "rounded-full border border-[#0a1a1f] bg-[#22d3ee] px-1",
              "text-[9.5px] font-extrabold text-[#04121a]",
              "shadow-[0_0_8px_#22d3ee,0_0_16px_rgba(34,211,238,0.75)]",
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "animate-dropdown-fade absolute top-[calc(100%+10px)] right-0 z-[100] w-[min(340px,calc(100vw-32px))]",
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
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className={cn(
          "flex cursor-pointer items-center gap-3.5 rounded-xl border border-line bg-surface px-3 py-1.5",
          "transition-all duration-300 ease-smooth hover:border-line-hover hover:bg-white/3",
        )}
      >
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-[13px] font-[750] text-fg">{name}</span>
          <span className="text-[11px] font-semibold text-muted">{roleLabel}</span>
        </div>
        <div className="size-9 shrink-0 overflow-hidden rounded-full border-[1.5px] border-[rgba(255,31,90,0.4)] shadow-[0_0_8px_rgba(255,31,90,0.3)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt="" className="size-full object-cover" />
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
