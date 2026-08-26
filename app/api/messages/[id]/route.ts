import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { isReaction } from "@/lib/messages";

type Ctx = { params: Promise<{ id: string }> };

interface ReactBody {
  /** A reaction from the fixed set, or null to take it back. */
  reaction?: string | null;
}

/**
 * PATCH /api/messages/:id -- set or clear the caller's reaction.
 *
 * One reaction per person: picking a second replaces the first, and
 * picking the same one again removes it. Announcements are one-way, so
 * this is the only thing a recipient can send back.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { reaction = null } = await readJson<ReactBody>(request);

  if (reaction !== null && !isReaction(reaction)) {
    throw new HttpError(400, "Unknown reaction.");
  }

  const me = user.username.toLowerCase();

  await updateDb((db) => {
    const message = db.cheatExeMessages.find((m) => m.id === id);
    if (!message) throw new HttpError(404, "Message not found.");

    if (reaction === null || message.reactions[me] === reaction) {
      delete message.reactions[me];
    } else {
      message.reactions[me] = reaction;
    }

    // Reacting means they have seen it.
    if (!message.readBy.includes(me)) message.readBy.push(me);
  });

  return NextResponse.json({ success: true });
});

/** DELETE /api/messages/:id -- withdraw an announcement. Owner only. */
export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  await requireOwner();
  const { id } = await ctx.params;
  const ip = await clientIp();

  const removed = await updateDb((db) => {
    const before = db.cheatExeMessages.length;
    db.cheatExeMessages = db.cheatExeMessages.filter((m) => m.id !== id);
    const gone = db.cheatExeMessages.length < before;

    if (gone) {
      pushAudit(db, { user: "Owner (OWNER)", action: "Deleted an announcement", ip });
    }
    return gone;
  });

  if (!removed) throw new HttpError(404, "Message not found.");
  return NextResponse.json({ success: true });
});
