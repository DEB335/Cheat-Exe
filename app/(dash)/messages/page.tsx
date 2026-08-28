"use client";

import { useState } from "react";

import { MegaphoneIcon, SendIcon, TrashIcon, UsersIcon } from "@/components/icons";
import { PrimaryButton, TintButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, HelpText } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { del, patchJson, postJson } from "@/lib/client-api";
import {
  applyClearMine,
  applyDeleteMessage,
  applyReaction,
} from "@/lib/optimistic";
import { MAX_BODY, REACTIONS } from "@/lib/messages";
import { useDashboard } from "@/lib/store";
import type { PublicAnnouncement } from "@/lib/types";
import { cn, formatStampForDisplay } from "@/lib/utils";

export default function MessagesPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patch = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);
  const messages = useDashboard((s) => s.db.cheatExeMessages);
  const isOwner = useDashboard((s) => s.user?.role === "OWNER");

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) {
      toast("Write a message first.", "error");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/messages", { body });
      setBody("");
      await refresh();
      toast("Announcement sent to everyone!", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const react = async (message: PublicAnnouncement, reaction: string) => {
    // Paint first. A write plus a re-read is ~half a second away, and
    // waiting for it is what made reacting feel unresponsive.
    const snapshot = patch((db) => applyReaction(db, message.id, reaction));
    try {
      await patchJson(`/api/messages/${message.id}`, {
        // Picking the same one again takes it back.
        reaction: message.myReaction === reaction ? null : reaction,
      });
      // No refresh: the realtime ping brings everyone else's view along,
      // and this tab already shows the result.
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  /**
   * Owner clears for everyone (they wrote them); a reseller clears only
   * their own view, so tidying up never silences someone else's panel.
   */
  const clearAll = async () => {
    const question = isOwner
      ? "Delete every announcement for everyone? This cannot be undone."
      : "Clear all announcements from your list? Others keep theirs.";
    if (!confirm(question)) return;
    const snapshot = patch(applyClearMine);
    try {
      await del(`/api/messages?scope=${isOwner ? "all" : "mine"}`);
      toast(isOwner ? "All announcements deleted." : "Your list is cleared.", "success");
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement for everyone?")) return;
    const snapshot = patch((db) => applyDeleteMessage(db, id));
    try {
      await del(`/api/messages/${id}`);
      toast("Announcement deleted.", "success");
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  return (
    <>
      {isOwner && (
        <Card className="mb-6">
          <CardHeader
            title="Send an Announcement"
            subtitle="Goes to every account. They see it on their next check-in, and immediately when they sign in."
            actions={
              <div className="flex size-8 items-center justify-center rounded-xl text-[#22d3ee]">
                <MegaphoneIcon className="size-4" />
              </div>
            }
          />

          <FormLabel htmlFor="msgBody">Message</FormLabel>
          <textarea
            id="msgBody"
            value={body}
            maxLength={MAX_BODY}
            rows={4}
            onChange={(event) => setBody(event.target.value)}
            placeholder="e.g. Prices are changing on Monday. Read the pinned notes before generating keys."
            className={cn(
              "mt-2 w-full resize-y rounded-xl border border-input-line bg-input-bg px-4 py-3",
              "text-[13.5px] leading-[1.5] text-fg outline-none transition-colors",
              "placeholder:text-[#475569] focus:border-[rgba(34,211,238,0.5)]",
            )}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <HelpText>Everyone gets a neon marker until they open it.</HelpText>
            <span className={cn("text-[11px]", body.length > MAX_BODY - 50 ? "text-orange" : "text-muted")}>
              {body.length} / {MAX_BODY}
            </span>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <PrimaryButton onClick={send} disabled={busy || !body.trim()}>
              <SendIcon className="size-4" strokeWidth={2.5} />
              {busy ? "SENDING..." : "SEND TO EVERYONE"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      <Card flat>
        <CardHeader
          title={isOwner ? "Sent Announcements" : "Announcements"}
          subtitle={
            isOwner
              ? "Reactions and read counts come back here."
              : "Notices from the owner. Tap a reaction to reply. They stay until you clear them."
          }
          actions={
            messages.length > 0 ? (
              <TintButton
                tone="red"
                onClick={clearAll}
                title={
                  isOwner
                    ? "Delete every announcement for everyone"
                    : "Remove these from your list only"
                }
              >
                <TrashIcon className="size-[13px]" strokeWidth={2.5} />
                {isOwner ? "Delete All" : "Clear All"}
              </TintButton>
            ) : undefined
          }
        />

        {messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">
            {isOwner ? "You have not sent anything yet." : "No announcements yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageCard
                key={m.id}
                message={m}
                isOwner={isOwner}
                onReact={(r) => react(m, r)}
                onDelete={() => remove(m.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function MessageCard({
  message,
  isOwner,
  onReact,
  onDelete,
}: {
  message: PublicAnnouncement;
  isOwner: boolean;
  onReact: (reaction: string) => void;
  onDelete: () => void;
}) {
  const total = Object.values(message.reactionCounts).reduce((a, b) => a + b, 0);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors sm:p-5",
        message.read
          ? "border-line bg-white/2"
          : "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.06)] shadow-[0_0_18px_rgba(34,211,238,0.1)]",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {!message.read && (
          <span className="rounded-full bg-[#22d3ee] px-2 py-[2px] text-[9px] font-extrabold tracking-[0.8px] text-[#04121a] uppercase shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            New
          </span>
        )}
        <span className="text-[12.5px] font-bold text-fg">{message.by}</span>
        <span className="text-[11px] text-muted">{formatStampForDisplay(message.at)}</span>

        {isOwner && (
          <div className="ml-auto flex items-center gap-3">
            <span
              title="How many accounts have opened it"
              className="flex items-center gap-1.5 text-[11px] text-muted"
            >
              <UsersIcon className="size-3.5" />
              {message.readCount ?? 0} seen
            </span>
            <button
              type="button"
              onClick={onDelete}
              title="Delete for everyone"
              className="cursor-pointer rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] p-1.5 text-[#ef4444] transition-colors hover:text-[#f87171]"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <p className="mb-3 text-[13.5px] leading-[1.6] break-words whitespace-pre-wrap text-fg">
        {message.body}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((r) => {
          const count = message.reactionCounts[r] ?? 0;
          const mine = message.myReaction === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onReact(r)}
              title={mine ? "Remove your reaction" : "React"}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1",
                "text-[12.5px] transition-all duration-200 hover:-translate-y-px",
                mine
                  ? "border-[rgba(34,211,238,0.5)] bg-[rgba(34,211,238,0.15)] text-[#67e8f9]"
                  : "border-line bg-white/2 text-muted hover:bg-white/6",
              )}
            >
              <span>{r}</span>
              {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
            </button>
          );
        })}

        {isOwner && total > 0 && (
          <span className="ml-1 text-[11px] text-muted">
            {total} reaction{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Only the owner is told who reacted -- a reseller must not learn
          who else is on the panel. */}
      {isOwner && message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {Object.entries(message.reactions).map(([name, r]) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white/2 px-2 py-[3px] text-[11px] text-muted"
            >
              <span className="text-[12px]">{r}</span>
              <span className="font-semibold text-fg">{name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
