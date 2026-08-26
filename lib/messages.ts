import type { Announcement, PublicAnnouncement, Role } from "./types";

/**
 * Owner announcements: one-way broadcast, with reactions coming back.
 *
 * Delivery is not a push. The dashboard already asks the server every few
 * seconds whether the session is still valid (that is what makes a ban or
 * a suspension land quickly), and the unread count rides along on that
 * answer -- so a message appears within one poll, and immediately on
 * login. True push would mean either a socket Vercel's serverless
 * functions cannot hold open, or Supabase Realtime, which reads through
 * the public anon key that schema.sql deliberately denies.
 */

/** The reactions a recipient may pick from. One per person, changeable. */
export const REACTIONS = ["\u{1F44D}", "\u{1F525}", "❤️", "✅", "\u{1F62E}"] as const;

export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

/** Newest first, and never unbounded. */
export const MAX_MESSAGES = 50;

/** Longest an announcement may be. */
export const MAX_BODY = 1000;

export function unreadFor(messages: Announcement[], username: string): number {
  const me = username.toLowerCase();
  return messages.filter((m) => !m.readBy.includes(me)).length;
}

/**
 * Reshapes stored messages for one viewer.
 *
 * A reseller must not learn who else is on the panel, so they get counts
 * and their own reaction -- never the map of usernames. The owner gets
 * the full breakdown, which is the point of collecting reactions at all.
 */
export function toPublicMessages(
  messages: Announcement[],
  username: string,
  role: Role,
): PublicAnnouncement[] {
  const me = username.toLowerCase();
  const isOwner = role === "OWNER";

  return messages.map((m) => {
    const counts: Record<string, number> = {};
    for (const reaction of Object.values(m.reactions)) {
      counts[reaction] = (counts[reaction] ?? 0) + 1;
    }

    return {
      id: m.id,
      body: m.body,
      by: m.by,
      at: m.at,
      read: m.readBy.includes(me),
      myReaction: m.reactions[me] ?? null,
      reactionCounts: counts,
      ...(isOwner ? { reactions: m.reactions, readCount: m.readBy.length } : {}),
    };
  });
}
