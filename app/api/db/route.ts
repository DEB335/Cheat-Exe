import { NextResponse } from "next/server";

import { loadDb, requireUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { toPublic } from "@/lib/db";
import { toPublicMessages } from "@/lib/messages";
import type { PublicDatabase } from "@/lib/types";

/**
 * The whole dashboard reads from here. Scoping happens on the server:
 * a reseller never receives other resellers' keys, the device list, or
 * the banned vault, so devtools cannot reveal them.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const raw = await loadDb();
  const db = toPublic(raw);

  // Announcements go to everyone -- that is the point of them -- but the
  // reaction map names other users, so it is shaped for the viewer.
  db.cheatExeMessages = toPublicMessages(raw.cheatExeMessages, user.username, user.role);

  if (user.role === "OWNER") {
    return NextResponse.json(db);
  }

  // A reseller sees their own record and no one else's -- the generator
  // needs their key limit and expiry to show what they have left.
  const own = Object.entries(db.cheatExeUsers).find(
    ([name]) => name.toLowerCase() === user.username.toLowerCase(),
  );

  const scoped: PublicDatabase = {
    ...db,
    cheatExeUsers: own ? { [own[0]]: own[1] } : {},
    cheatExeBannedUsers: [],
    cheatExeBans: [],
    cheatExeKeyHistory: db.cheatExeKeyHistory.filter((k) => k.creator === user.username),
    cheatExeDevices: db.cheatExeDevices.filter((d) => d.sessionId === user.sessionId),
    cheatExeAuditLogs: db.cheatExeAuditLogs.filter((log) =>
      log.user.toLowerCase().startsWith(user.username.toLowerCase()),
    ),
  };
  return NextResponse.json(scoped);
});
