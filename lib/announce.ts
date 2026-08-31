import "server-only";

import { pushAudit } from "./api-helpers";
import type { Tx } from "./db";
import { MAX_MESSAGES } from "./messages";
import { ping } from "./realtime";
import type { Announcement, AuditLog, Database } from "./types";
import { formatTimestamp } from "./utils";

/**
 * Records a broadcast and wakes every dashboard.
 *
 * Shared by the two ways one can start: the owner typing into the panel,
 * and a post in the Discord announcements channel arriving through
 * /api/messages/ingest. Both produce the same record, so reactions, read
 * receipts and clearing behave identically whichever door it came in by
 * -- the only difference a recipient sees is the Discord badge.
 *
 * Call inside `updateDb`, and pass its transaction: the ping rides along
 * on it rather than paying for a round trip of its own.
 */
export async function addAnnouncement(
  db: Database,
  tx: Tx,
  input: {
    /** Already trimmed and length-checked by the caller. */
    body: string;
    /** Display name recipients see. */
    by: string;
    /** Lowercased username to pre-mark as read -- whoever sent it. */
    seenBy: string;
    source: NonNullable<Announcement["source"]>;
    /** Set for Discord posts, and what makes re-delivery harmless. */
    discordId?: string;
    audit: Omit<AuditLog, "timestamp">;
  },
): Promise<Announcement> {
  const entry: Announcement = {
    id: crypto.randomUUID(),
    body: input.body,
    by: input.by,
    at: formatTimestamp(),
    // The sender does not need to be told about their own message.
    readBy: [input.seenBy],
    reactions: {},
    source: input.source,
    ...(input.discordId ? { discordId: input.discordId } : {}),
  };

  db.cheatExeMessages.unshift(entry);
  if (db.cheatExeMessages.length > MAX_MESSAGES) db.cheatExeMessages.length = MAX_MESSAGES;

  pushAudit(db, input.audit);

  // Wake every open dashboard now rather than at their next poll --
  // inside this transaction, so it costs no extra round trip.
  await ping("message", tx);

  return entry;
}

/** The audit line's summary of an announcement, kept to one readable row. */
export function announcementSummary(text: string): string {
  return `"${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`;
}
