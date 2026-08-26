import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { MAX_BODY, MAX_MESSAGES } from "@/lib/messages";
import { ping } from "@/lib/realtime";
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

  const message = await updateDb(async (db, tx): Promise<Announcement> => {
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

    // Wake every open dashboard now rather than at their next poll --
    // inside this transaction, so it costs no extra round trip.
    await ping("message", tx);

    return entry;
  });

  return NextResponse.json({ success: true, id: message.id });
});

/**
 * DELETE /api/messages -- clear the list.
 *
 * `?scope=mine` (the default, and all a reseller may do) hides every
 * current announcement from the caller alone; everyone else keeps theirs,
 * and a later announcement still arrives normally. `?scope=all` is the
 * owner withdrawing them for everybody, which deletes the records.
 */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser();
  const scope = new URL(request.url).searchParams.get("scope") ?? "mine";
  if (scope !== "mine" && scope !== "all") {
    throw new HttpError(400, "scope must be 'mine' or 'all'.");
  }
  if (scope === "all" && user.role !== "OWNER") {
    throw new HttpError(403, "Owner access required");
  }

  const me = user.username.toLowerCase();
  const ip = await clientIp();

  const cleared = await updateDb(async (db, tx) => {
    if (scope === "all") {
      const n = db.cheatExeMessages.length;
      db.cheatExeMessages = [];
      if (n > 0) {
        pushAudit(db, {
          user: "Owner (OWNER)",
          action: `Deleted all ${n} announcement(s) for everyone`,
          ip,
        });
        await ping("message", tx);
      }
      return n;
    }

    let n = 0;
    for (const message of db.cheatExeMessages) {
      const list = (message.clearedBy ??= []);
      if (!list.includes(me)) {
        list.push(me);
        // Clearing implies having seen it, so the marker goes too.
        if (!message.readBy.includes(me)) message.readBy.push(me);
        n += 1;
      }
    }
    // Nobody else's view changed, so there is nothing to broadcast.
    return n;
  });

  return NextResponse.json({ success: true, cleared });
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

  await updateDb(async (db, tx) => {
    let changed = false;
    for (const message of db.cheatExeMessages) {
      if (!message.readBy.includes(me)) {
        message.readBy.push(me);
        changed = true;
      }
    }
    // Only ring the bell if something actually changed -- opening an
    // already-read panel should not wake every other dashboard.
    if (changed) await ping("message", tx);
  });

  return NextResponse.json({ success: true });
});
