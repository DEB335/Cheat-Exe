"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { subscribeBroadcast } from "./broadcast";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Realtime is always wired up via SSE stream and cross-tab BroadcastChannel. */
export const REALTIME_ENABLED = true;

/** How long to wait for a burst to settle before refetching once. */
const COALESCE_MS = 250;

export function useRealtimePing(onPing: () => void): void {
  const handler = useRef(onPing);
  useEffect(() => {
    handler.current = onPing;
  }, [onPing]);

  useEffect(() => {
    let timer = 0;
    let disposed = false;

    const coalesced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => handler.current(), COALESCE_MS);
    };

    // 1. Instant cross-tab BroadcastChannel (0ms latency within browser)
    const unsubBroadcast = subscribeBroadcast(coalesced);

    // 2. Server-Sent Events (SSE) stream for real-time notifications
    let eventSource: EventSource | null = null;
    if (typeof window !== "undefined") {
      try {
        eventSource = new EventSource("/api/realtime");
        eventSource.addEventListener("ping", coalesced);
        eventSource.onerror = () => {
          // Automatic browser reconnect handled by EventSource
        };
      } catch {
        /* fallback to poll */
      }
    }

    // 3. Supabase Realtime if credentials are provided in env
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    if (URL_ && KEY) {
      void import("@supabase/supabase-js")
        .then(({ createClient }) => {
          if (disposed) return;
          supabase = createClient(URL_, KEY, {
            auth: { persistSession: false },
            realtime: { params: { eventsPerSecond: 4 } },
          });
          channel = supabase
            .channel("cheatexe-pings")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "realtime_pings" },
              coalesced,
            )
            .subscribe();
        })
        .catch(() => {
          /* the poll covers it */
        });
    }

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unsubBroadcast();
      if (eventSource) {
        eventSource.close();
      }
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);
}

