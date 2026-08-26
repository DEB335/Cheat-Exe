"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether realtime is wired up at all. Without it the poll still works. */
export const REALTIME_ENABLED = Boolean(URL_ && KEY);

/**
 * Subscribes to the content-free ping table and runs `onPing` when the
 * server rings it.
 *
 * This is an accelerator, not a replacement: the five-second poll stays
 * exactly as it was, so a dropped socket, a sleeping laptop or a missing
 * anon key degrades to "arrives within five seconds" rather than "never
 * arrives". Nothing about correctness depends on the socket.
 *
 * The callback is held in a ref so a caller passing an inline function
 * does not tear the subscription down and rebuild it on every render.
 */
/** How long to wait for a burst to settle before refetching once. */
const COALESCE_MS = 400;

export function useRealtimePing(onPing: () => void): void {
  const handler = useRef(onPing);
  useEffect(() => {
    handler.current = onPing;
  }, [onPing]);

  useEffect(() => {
    if (!URL_ || !KEY) return;

    const supabase = createClient(URL_, KEY, {
      auth: { persistSession: false },
      // A burst of announcements should not become a burst of refetches.
      realtime: { params: { eventsPerSecond: 4 } },
    });

    let channel: RealtimeChannel | null = null;
    let timer = 0;

    // Pings arrive in bursts -- reacting also marks a message read -- and
    // every open dashboard answers each one with a full refetch. Measured
    // with five connected tabs, a single reaction produced six /api/db
    // reads against a three-connection pool. Coalescing makes a flurry
    // cost one refetch per tab instead of one per ping per tab.
    const coalesced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => handler.current(), COALESCE_MS);
    };

    try {
      channel = supabase
        .channel("cheatexe-pings")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "realtime_pings" },
          coalesced,
        )
        .subscribe();
    } catch {
      /* the poll covers it */
    }

    return () => {
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}
