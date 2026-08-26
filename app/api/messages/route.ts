import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { MAX_BODY, MAX_MESSAGES } from "@/lib/messages";
import type { Announcement } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

interface CreateBody {
  body?: string;
}

/** POST /api/messages -- broadcast an announcement. Owner only. */
export const POST = route(async (request: Request) => {
  const owner = await requireOwner();
  const { body = "" } = await readJson<CreateBody>(request);

  const text = body.trim();
  if (!text) throw new HttpError(400, "Write a message first.");
  if (text.length > MAX_BODY) {
    throw new HttpError(400, `Message must be ${MAX_BODY} characters or fewer.`);
  }

  const ip = await clientIp();

  const message = await updateDb((db): Announcement => {
    const entry: Announcement = {
      id: crypto.randomUUID(),
      body: text,
      by: db.profile.displayName || owner.username,
      at: formatTimestamp(),
      // The sender does not need to be told about their own message.
      readBy: [owner.username.toLowerCase()],
      reactions: {},
    };

    db.cheatExeMessages.unshift(entry);
    if (db.cheatExeMessages.length > MAX_MESSAGES) db.cheatExeMessages.length = MAX_MESSAGES;

    pushAudit(db, {
      user: "Owner (OWNER)",
      action: `Sent an announcement: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`,
      ip,
    });

    return entry;
  });

  return NextResponse.json({ success: true, id: message.id });
});

/**
 * PATCH /api/messages -- mark every announcement read for the caller.
 *
 * This is what opening the notification panel does, and what clears the
 * neon dot. Any signed-in account may do it, for themselves only.
 */
export const PATCH = route(async () => {
  const user = await requireUser();
  const me = user.username.toLowerCase();

  await updateDb((db) => {
    for (const message of db.cheatExeMessages) {
      if (!message.readBy.includes(me)) message.readBy.push(me);
    }
  });

  return NextResponse.json({ success: true });
});
