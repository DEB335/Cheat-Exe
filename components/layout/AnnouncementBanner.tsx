"use client";

import { useState } from "react";

import { CloseIcon, MegaphoneIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { patchJson } from "@/lib/client-api";
import { applyReadAll } from "@/lib/optimistic";
import { useDashboard } from "@/lib/store";
import { cn, formatStampForDisplay } from "@/lib/utils";

/**
 * Sticky strip for the newest unread announcement.
 *
 * The notification icon alone is easy to walk past, so anything the owner
 * broadcasts also sits across the top of the panel until it is
 * acknowledged. Acknowledging marks *every* message read, which is the
 * same thing opening the notification panel does -- two routes to the
 * same state rather than two competing unread counts.
 */
export function AnnouncementBanner() {
  const messages = useDashboard((s) => s.db.cheatExeMessages);
  const patch = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const unread = messages.filter((m) => !m.read);
  const newest = unread[0];
  if (!newest) return null;

  const acknowledge = async () => {
    setBusy(true);
    // The banner disappears on click, not a round trip later.
    const snapshot = patch(applyReadAll);
    try {
      await patchJson("/api/messages", {});
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 pb-1 lg:px-10">
      <div
        className={cn(
          "relative flex items-start gap-3 overflow-hidden rounded-2xl px-4 py-3.5 sm:px-5",
          "border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.07)]",
          "shadow-[0_0_25px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]",
          "backdrop-blur-[10px] lt:bg-[rgba(34,211,238,0.08)]",
        )}
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.12)] text-[#22d3ee] shadow-[0_0_12px_rgba(34,211,238,0.35)]">
          <MegaphoneIcon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold tracking-[1.4px] text-[#22d3ee] uppercase">
              Announcement
            </span>
            {unread.length > 1 && (
              <span className="rounded-full border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.12)] px-2 py-[1px] text-[9.5px] font-bold text-[#67e8f9]">
                +{unread.length - 1} more
              </span>
            )}
            <span className="text-[11px] text-muted">
              {newest.by} &bull; {formatStampForDisplay(newest.at)}
            </span>
          </div>
          <p className="text-[13.5px] leading-[1.5] break-words whitespace-pre-wrap text-fg">
            {newest.body}
          </p>
        </div>

        <button
          type="button"
          onClick={acknowledge}
          disabled={busy}
          title="Mark all announcements as read"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5",
            "border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.1)] text-[11.5px] font-bold text-[#67e8f9]",
            "transition-colors hover:bg-[rgba(34,211,238,0.2)] hover:text-white disabled:opacity-50",
          )}
        >
          <CloseIcon className="size-3" />
          {busy ? "..." : "Got it"}
        </button>
      </div>
    </div>
  );
}
