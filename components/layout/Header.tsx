"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { setBackgroundMusicMuted } from "@/components/effects/BackgroundVideo";
import {
  BellIcon,
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
import { api } from "@/lib/client-api";
import { PAGE_TITLES, SEARCH_ITEMS } from "@/lib/nav";
import { useDashboard } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";


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
      <ProfileMenu />
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

function ProfileMenu() {
  const router = useRouter();
  const toast = useToast();
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
              router.push("/profile");
              toast("Notification settings opened!", "success");
              setOpen(false);
            }}
          >
            <BellIcon className="size-4" />
            Notifications
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
