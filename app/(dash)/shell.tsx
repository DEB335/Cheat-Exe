"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BackgroundVideo, GridBackdrop } from "@/components/effects/BackgroundVideo";
import { CursorSparks } from "@/components/effects/CursorSparks";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { useDashboard } from "@/lib/store";
import { useRealtimePing } from "@/lib/use-realtime";
import type { SessionUser } from "@/lib/types";

/**
 * How often to check whether this session is still allowed to be open.
 *
 * This is also what delivers announcements and what makes a ban, a
 * suspension or a device lock take effect, so it doubles as the panel's
 * worst-case latency for all of them. The request is small -- one row
 * read, answering with the session and an unread count -- and the
 * messages themselves are only fetched when that count actually changes.
 */
const SESSION_POLL_MS = 5_000;

/** Reason codes /api/auth/session returns when it terminates a session. */
type Terminated =
  | "banned"
  | "suspended"
  | "pending"
  | "expired"
  | "deleted"
  | "device"
  | "locked"
  | "kicked";

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
};

/** How long the notice stays up before the redirect. */
const NOTICE_MS = 2600;

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const setUser = useDashboard((s) => s.setUser);
  const refresh = useDashboard((s) => s.refresh);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [terminated, setTerminated] = useState<Terminated | null>(null);

  useEffect(() => {
    setUser(user);
    void refresh();
  }, [user, setUser, refresh]);

  // Replaces the old client-side banned poll: the server decides. A
  // terminated session is told what happened -- a reseller who is
  // suspended mid-session used to be bounced to the login screen with no
  // explanation at all -- and then sent out.
  // Asks the server whether this session may still be open, and what to
  // say if not. Lifted out of the poll so the realtime channel can run it
  // too: a suspension pings, and without this the ping would only trigger
  // a data refresh, leaving the reason to arrive on the next tick.
  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as {
        user: SessionUser | null;
        terminated?: Terminated;
        unread?: number;
      };

      if (data.user) {
        // The poll carries the unread count, so a new announcement costs
        // no extra request -- pull the messages themselves only when the
        // server's count disagrees with what is already loaded.
        const loaded = useDashboard
          .getState()
          .db.cheatExeMessages.filter((m) => !m.read).length;
        if (typeof data.unread === "number" && data.unread !== loaded) void refresh();
        return;
      }

      setTerminated(data.terminated ?? "kicked");
    } catch {
      /* offline -- try again on the next tick */
    }
  }, [refresh]);

  useEffect(() => {
    if (terminated) return;

    // Only poll a tab someone is actually looking at.
    //
    // At five seconds a panel left open in a background tab would spend
    // the day asking a question nobody is there to read the answer to.
    // Hidden tabs stop entirely and catch up the moment they come back,
    // which also means a returning tab is up to date immediately rather
    // than after the next tick.
    let id = 0;
    const start = () => {
      if (!id) id = window.setInterval(check, SESSION_POLL_MS);
    };
    const stop = () => {
      if (id) {
        window.clearInterval(id);
        id = 0;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void check();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
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

  // Hold the notice on screen long enough to read, then hand over to the
  // login page, which shows the same reason.
  useEffect(() => {
    if (!terminated) return;
    const id = window.setTimeout(() => {
      router.replace(`/login?reason=${terminated}`);
      router.refresh();
    }, NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [terminated, router]);

  // Matches the original panel behaviour.
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      toast("Right click is disabled on this panel!", "error");
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [toast]);

  return (
    <>
      <BackgroundVideo />
      <GridBackdrop />
      <CursorSparks />

      {terminated && <TerminatedNotice reason={terminated} />}

      <div className="relative flex min-h-screen lg:h-screen lg:overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

        <main className="relative z-[2] flex min-w-0 flex-1 flex-col lg:m-5 lg:ml-0 lg:h-[calc(100vh-40px)] lg:overflow-hidden">
          <Header pathname={pathname} onOpenMobile={() => setMobileOpen(true)} />
          <AnnouncementBanner />
          <div
            data-probe="content"
            className="animate-tab-fade-in relative z-[1] min-w-0 flex-1 px-6 pb-10 lg:overflow-x-hidden lg:overflow-y-auto lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

/** Full-screen takeover shown the moment a session stops being valid. */
function TerminatedNotice({ reason }: { reason: Terminated }) {
  const copy = TERMINATED_COPY[reason];

  return (
    <div
      role="alertdialog"
      aria-modal
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[rgba(4,7,17,0.96)] px-6 text-center backdrop-blur-[6px]"
    >
      <h1
        className="mb-3 text-[22px] font-extrabold tracking-[2px] sm:text-[28px]"
        style={{ color: copy.tone }}
      >
        {copy.title}
      </h1>
      <p className="max-w-[420px] text-[13.5px] leading-[1.6] text-muted">{copy.body}</p>
      <p className="mt-6 text-[12px] tracking-[1.5px] text-muted uppercase">
        Returning to sign in...
      </p>
    </div>
  );
}
