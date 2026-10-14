"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BackgroundMusic } from "@/components/effects/BackgroundMusic";
import { CursorSparks } from "@/components/effects/CursorSparks";
import { Wind404 } from "@/components/effects/Wind404";
import { GridBackdrop } from "@/components/effects/GridBackdrop";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { canAccessEmulatorBypass, canManageWhitelist } from "@/lib/packages";
import { publishPing } from "@/lib/ping";
import { SESSION_LIFETIME_MINUTES } from "@/lib/session-lifetime";
import { isRefreshing, useDashboard, useEffectiveUser, useMyPackages } from "@/lib/store";
import { useHwidSweep } from "@/lib/use-hwid-sweep";
import { useInspectGuard } from "@/lib/use-inspect-guard";
import { useRealtimePing } from "@/lib/use-realtime";
import type { SessionUser } from "@/lib/types";

/**
 * How often to check whether this session is still allowed to be open.
 *
 * This is also what delivers announcements and what makes a ban, a
 * suspension or a device lock take effect, so it doubles as the panel's
 * worst-case latency for all of them. Polled at 2.5s for fast real-time sync.
 */
const SESSION_POLL_MS = 2_500;

/** Reason codes /api/auth/session returns when it terminates a session. */
type Terminated =
  | "banned"
  | "suspended"
  | "pending"
  | "expired"
  | "deleted"
  | "device"
  | "locked"
  | "kicked"
  | "timeout";

const TERMINATED_COPY: Record<Terminated, { title: string; body: string; tone: string }> = {
  banned: {
    title: "ACCOUNT TERMINATED",
    body: "Access to this platform has been revoked.",
    tone: "#ef4444",
  },
  suspended: {
    title: "ACCOUNT SUSPENDED",
    body: "The owner has suspended this account. You are being signed out.",
    tone: "#f59e0b",
  },
  pending: {
    title: "ACCOUNT PENDING APPROVAL",
    body: "This account is waiting to be activated by the owner.",
    tone: "#f59e0b",
  },
  deleted: {
    title: "ACCOUNT REMOVED",
    body: "This account no longer exists.",
    tone: "#ef4444",
  },
  expired: {
    title: "VALIDITY ENDED",
    body: "This account's validity period has run out. Ask the owner to renew it.",
    tone: "#f59e0b",
  },
  device: {
    title: "DEVICE BLOCKED",
    body: "This device or network has been blocked from the panel.",
    tone: "#ef4444",
  },
  locked: {
    title: "WRONG DEVICE",
    body: "This account is locked to another machine. Ask the owner to reset its HWID.",
    tone: "#f59e0b",
  },
  kicked: {
    title: "SESSION ENDED",
    body: "Your session was closed from the owner panel.",
    tone: "#60a5fa",
  },
  timeout: {
    title: "SESSION EXPIRED",
    body: "Sessions expire after 1 hour of inactivity. Sign in again to continue.",
    tone: "#38bdf8",
  },
};

/** How long the notice stays up before the redirect. */
const NOTICE_MS = 2600;

export function Shell({
  user,
  expiresIn,
  children,
}: {
  user: SessionUser;
  /** Seconds left in this session, measured on the server at render. */
  expiresIn: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const setUser = useDashboard((s) => s.setUser);
  const refresh = useDashboard((s) => s.refresh);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Stable, so the memoised sidebar is not re-rendered by every render here.
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const [terminated, setTerminated] = useState<Terminated | null>(null);
  const effectiveUser = useEffectiveUser();
  const packages = useMyPackages();

  const lastUpdatedAt = useRef<string | null>(null);

  // Losing a package while standing on the page it unlocked should not
  // leave someone parked there.
  useEffect(() => {
    if (terminated || !effectiveUser) return;
    if (pathname.startsWith("/uid-bypass")) {
      if (canManageWhitelist(effectiveUser)) return;
      toast("UID Bypass access was removed from your account.", "error");
      router.replace("/dashboard");
    } else if (pathname.startsWith("/emulator-bypass")) {
      if (canAccessEmulatorBypass(effectiveUser)) return;
      toast("Emulator Bypass access was revoked from your account.", "error");
      router.replace("/dashboard");
    }
  }, [terminated, effectiveUser, pathname, router, toast]);

  const userKey = JSON.stringify(user);
  useEffect(() => {
    setUser(JSON.parse(userKey) as SessionUser);
    void refresh();
  }, [userKey, setUser, refresh]);

  // Check and touch session
  const check = useCallback(async (touch = false) => {
    try {
      const started = performance.now();
      const url = touch ? "/api/auth/session?touch=1" : "/api/auth/session";
      const response = await fetch(url, { cache: "no-store" }).catch(() => null);
      publishPing(response ? performance.now() - started : null);
      if (!response) return;
      const data = (await response.json()) as {
        user: SessionUser | null;
        terminated?: Terminated;
        unread?: number;
        updatedAt?: string;
      };

      if (data.user) {
        const store = useDashboard.getState();
        const prevUserStr = JSON.stringify(store.user);
        const nextUserStr = JSON.stringify(data.user);
        if (prevUserStr !== nextUserStr) {
          setUser(data.user);
          void refresh();
        }

        const loaded = store.db.cheatExeMessages.filter((m) => !m.read).length;
        if (typeof data.unread === "number" && data.unread !== loaded && !isRefreshing()) {
          void refresh();
        }

        if (data.updatedAt && data.updatedAt !== lastUpdatedAt.current) {
          lastUpdatedAt.current = data.updatedAt;
          if (!isRefreshing()) void refresh();
        }
        return;
      }

      setTerminated(data.terminated ?? "kicked");
    } catch {
      /* offline -- try again on the next tick */
    }
  }, [refresh, setUser]);

  /**
   * User Activity Tracking & Sliding Idle Expiry:
   * 1. If user is actively typing, clicking, scrolling, or interacting,
   *    we extend the session token by pinging /api/auth/session?touch=1 (throttled).
   * 2. If idle with no interaction for 1 hour (3600 seconds), session expires.
   */
  useEffect(() => {
    if (terminated) return;

    let lastActivity = Date.now();
    let lastTouch = Date.now();

    const onActivity = () => {
      lastActivity = Date.now();
      // Throttle renewal touch to every 2 minutes of active use
      if (Date.now() - lastTouch > 2 * 60 * 1000) {
        lastTouch = Date.now();
        void check(true);
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;
    for (const evt of events) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    // Check idle duration every 10 seconds
    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      const maxIdleMs = (expiresIn || 3600) * 1000;
      if (idleMs >= maxIdleMs) {
        setTerminated("timeout");
      }
    }, 10_000);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, onActivity);
      }
      window.clearInterval(interval);
    };
  }, [expiresIn, terminated, check]);

  // Immediate client-side check if reseller account was deleted or suspended
  const dbUsers = useDashboard((s) => s.db.cheatExeUsers);
  const dbLoading = useDashboard((s) => s.loading);
  useEffect(() => {
    if (terminated || !user || user.role === "OWNER" || dbLoading) return;
    if (Object.keys(dbUsers).length > 0) {
      const match = Object.entries(dbUsers).find(
        ([name]) => name.toLowerCase() === user.username.toLowerCase(),
      );
      if (!match) {
        setTerminated("deleted");
        void check(false);
      } else if (match[1].status === "SUSPENDED") {
        setTerminated("suspended");
        void check(false);
      }
    }
  }, [terminated, user, dbUsers, dbLoading, check]);

  // Listen for terminal events from background fetch errors
  useEffect(() => {
    const onSessionTerminated = (e: Event) => {
      const custom = e as CustomEvent<Terminated>;
      if (custom.detail) {
        setTerminated(custom.detail);
      } else {
        void check(false);
      }
    };
    window.addEventListener("session-terminated", onSessionTerminated);
    return () => window.removeEventListener("session-terminated", onSessionTerminated);
  }, [check]);

  useEffect(() => {
    if (terminated) return;

    const id = window.setInterval(() => void check(false), SESSION_POLL_MS);

    const onWake = () => {
      void check(false);
    };

    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [terminated, check]);

  // Instant path for anything the server pushes. The poll above still runs
  // and still decides session validity; this only shortens the wait when
  // the socket is up, and changes nothing when it is not.
  //
  // Both calls matter. `refresh` brings new data, and `check` brings the
  // reason a session just stopped being valid -- an owner suspending a
  // reseller pings, and the reseller should be told why then, not at the
  // next tick.
  useRealtimePing(() => {
    if (terminated) return;
    void check();
    void refresh();
  });

  // Hold the notice on screen to allow interaction, then hand over to login
  useEffect(() => {
    if (!terminated) return;
    // For timeout, let the user interact with the detective screen or click back;
    // for security kicks/bans, redirect after NOTICE_MS
    if (terminated === "timeout") return;
    const id = window.setTimeout(() => {
      router.replace(`/login?reason=${terminated}`);
      router.refresh();
    }, NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [terminated, router]);

  // Matches the original panel's right-click block, extended to the
  // keyboard shortcuts that open the same inspector. See the hook for
  // what this does and does not actually prevent.
  useInspectGuard((message) => toast(message, "error"));

  // Frees the device of every HWID-unlocked key every 20 s while this tab
  // is visible. See the hook.
  useHwidSweep();

  return (
    <>
      <BackgroundMusic />
      {/* Solid dark base behind the dashboard. Hidden in light mode, which
          paints its own page colour. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-2 bg-[#040718] lt:hidden" />
      <GridBackdrop />
      <CursorSparks />

      {terminated && <TerminatedNotice reason={terminated} />}

      <div className="relative flex min-h-app-screen lg:h-app-screen lg:overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobile} />

        {/* Full height, no outer margin: the header and the content column
            carry their own padding, so the scroller runs to the bottom of
            the screen instead of clipping cards 20px short of it. */}
        <main className="relative z-[2] flex min-w-0 flex-1 flex-col lg:h-app-screen lg:overflow-hidden">
          <Header pathname={pathname} onOpenMobile={openMobile} />
          <AnnouncementBanner />
          {/* The scrollbar gutter is always reserved, so a page that scrolls
              and one that does not end their cards on the same line as the
              header: 28px + the 6px scrollbar = the header's 34px. */}
          <div
            data-probe="content"
            className="animate-tab-fade-in relative z-[1] min-w-0 flex-1 px-4 pt-4 pb-10 sm:px-6 lg:overflow-x-hidden lg:overflow-y-auto lg:pt-[26px] lg:pr-[28px] lg:pb-8 lg:pl-[38px] lg:[scrollbar-gutter:stable]">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

/** Full-screen takeover shown the moment a session stops being valid. */
function TerminatedNotice({ reason }: { reason: Terminated }) {
  const router = useRouter();

  if (reason === "timeout") {
    return (
      <Wind404
        title="404"
        subtitle="Nothing at this address but the wind. Sessions expire after 1 hour of inactivity."
        backText="Back to sign in"
        onBack={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/login?reason=timeout";
          }
        }}
      />
    );
  }

  const copy = TERMINATED_COPY[reason];

  return (
    <div
      role="alertdialog"
      aria-modal
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#050814]/95 px-4 text-center backdrop-blur-2xl"
    >
      <div
        className="pointer-events-none absolute h-[320px] w-[320px] rounded-full blur-[100px] opacity-25"
        style={{ background: copy.tone }}
      />
      <div
        className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0c1228]/85 p-8 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_30px_rgba(56,189,248,0.12)] backdrop-blur-xl"
        style={{ borderColor: `${copy.tone}33` }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner"
          style={{
            borderColor: `${copy.tone}4d`,
            background: `radial-gradient(circle, ${copy.tone}22 0%, ${copy.tone}05 100%)`,
            boxShadow: `0 0 24px ${copy.tone}33`,
          }}
        >
          <svg
            className="h-8 w-8"
            style={{ color: copy.tone }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1
          className="mb-2 text-[20px] font-black tracking-[2px] sm:text-[24px]"
          style={{
            color: copy.tone,
            textShadow: `0 0 20px ${copy.tone}66`,
          }}
        >
          {copy.title}
        </h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-slate-300">{copy.body}</p>
        <div className="flex items-center justify-center gap-2 text-xs font-medium tracking-widest text-slate-400 uppercase">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-sky-400" />
          <span>Returning to sign in...</span>
        </div>
      </div>
    </div>
  );
}
