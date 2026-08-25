"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BackgroundVideo, GridBackdrop } from "@/components/effects/BackgroundVideo";
import { CursorSparks } from "@/components/effects/CursorSparks";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { useDashboard } from "@/lib/store";
import type { SessionUser } from "@/lib/types";

/** How often to check whether this session was kicked or banned. */
const SESSION_POLL_MS = 15_000;

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const setUser = useDashboard((s) => s.setUser);
  const refresh = useDashboard((s) => s.refresh);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setUser(user);
    void refresh();
  }, [user, setUser, refresh]);

  // Replaces the old client-side banned poll: the server decides, and a
  // terminated session is redirected out.
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { user: SessionUser | null };
        if (!data.user) router.push("/login");
      } catch {
        /* offline -- try again on the next tick */
      }
    };
    const id = window.setInterval(check, SESSION_POLL_MS);
    return () => window.clearInterval(id);
  }, [router]);

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

      <div className="relative flex min-h-screen lg:h-screen lg:overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

        <main className="relative z-[2] flex min-w-0 flex-1 flex-col lg:m-5 lg:ml-0 lg:h-[calc(100vh-40px)] lg:overflow-hidden">
          <Header pathname={pathname} onOpenMobile={() => setMobileOpen(true)} />
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
