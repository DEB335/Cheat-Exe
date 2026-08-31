import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { addAnnouncement, announcementSummary } from "@/lib/announce";
import { readJson, route } from "@/lib/api-helpers";
import { HttpError } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { MAX_BODY } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/messages/ingest -- a Discord post becomes an announcement.
 *
 * The same broadcast the owner sends from the panel, started from the
 * other end: the bot watches #client-announcement and forwards what
 * lands there, so a notice written once in Discord reaches every client
 * dashboard without being retyped here.
 *
 * There is no session behind this call. The bot is a server, not a
 * browser -- it holds no cookie -- so it proves itself with a shared
 * secret instead. That secret is the only thing standing between a
 * stranger and a broadcast to every paying client, so it is compared in
 * constant time, must be long enough to be worth having, and the route
 * refuses to run at all when it has not been set.
 */

interface IngestBody {
  body?: string;
  /** Discord display name of whoever posted. Recorded in the audit log. */
  author?: string;
  /** Discord message id. Makes a repeat delivery a no-op. */
  discordId?: string;
}

/** Shortest secret worth accepting. Anything less is a typo, not a key. */
const MIN_SECRET = 24;

function constantTimeEqual(a: string, b: string): boolean {
  // Hash first: timingSafeEqual throws when the two sides differ in
  // length, and catching that would leak whether a guess was the right
  // size. Digests are always 32 bytes, so every comparison looks alike.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function authorise(request: Request): void {
  const secret = process.env.DISCORD_BRIDGE_SECRET ?? "";
  if (secret.length < MIN_SECRET) {
    throw new HttpError(503, "The Discord bridge is not configured.");
  }

  const header = request.headers.get("authorization") ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!offered || !constantTimeEqual(offered, secret)) {
    throw new HttpError(401, "Bad bridge secret.");
  }
}

export const POST = route(async (request: Request) => {
  authorise(request);

  // One bot, one channel: a burst past this is a loop or a runaway
  // catch-up, and neither should be allowed to hammer the database.
  const { ok, retryAfter } = rateLimit("discord-ingest", 30, 60_000);
  if (!ok) throw new HttpError(429, `Too many announcements. Try again in ${retryAfter}s.`);

  const { body = "", author = "", discordId = "" } = await readJson<IngestBody>(request);

  const text = body.trim();
  const key = discordId.trim();
  if (!text) throw new HttpError(400, "The Discord message had no text to forward.");
  if (!key) throw new HttpError(400, "discordId is required.");

  // Discord allows twice what an announcement may be, so a long post is
  // cut rather than refused: better that clients read most of it than
  // that a notice silently fails to arrive.
  const truncated = text.length > MAX_BODY;
  const finalText = truncated ? `${text.slice(0, MAX_BODY - 1).trimEnd()}…` : text;

  const result = await updateDb(async (db, tx) => {
    // Inside the transaction so two deliveries racing cannot both pass.
    if (db.cheatExeMessages.some((m) => m.discordId === key)) {
      return { duplicate: true as const, id: null };
    }

    const by = db.profile.displayName || db.adminUser;
    const entry = await addAnnouncement(db, tx, {
      body: finalText,
      // Recipients see the panel's own name, not a Discord handle, so a
      // notice reads the same wherever it was written. Who actually
      // posted is kept in the audit log below.
      by,
      // The owner wrote it in Discord; do not mark it unread for them.
      seenBy: db.adminUser.toLowerCase(),
      source: "discord",
      discordId: key,
      audit: {
        user: author ? `${author} (DISCORD)` : "Discord",
        action: `Announcement from #client-announcement: ${announcementSummary(finalText)}`,
        // No proxy header worth trusting here, and the secret is what
        // authorised this, not an address.
        ip: "discord-bridge",
      },
    });

    return { duplicate: false as const, id: entry.id };
  });

  // A duplicate is a success: the bot retried, and the message is here.
  return NextResponse.json({ success: true, ...result, truncated });
});
