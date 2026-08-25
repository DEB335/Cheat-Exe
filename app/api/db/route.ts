import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { readDb, toPublic } from "@/lib/db";
import type { PublicDatabase } from "@/lib/types";

/**
 * The whole dashboard reads from here. Scoping happens on the server:
 * a reseller never receives other resellers' keys, the device list, or
 * the banned vault, so devtools cannot reveal them.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const db = toPublic(await readDb());

  if (user.role === "OWNER") {
    return NextResponse.json(db);
  }

  const scoped: PublicDatabase = {
    ...db,
    cheatExeUsers: {},
    cheatExeBannedUsers: [],
    cheatExeKeyHistory: db.cheatExeKeyHistory.filter((k) => k.creator === user.username),
    cheatExeDevices: db.cheatExeDevices.filter((d) => d.sessionId === user.sessionId),
    cheatExeAuditLogs: db.cheatExeAuditLogs.filter((log) =>
      log.user.toLowerCase().startsWith(user.username.toLowerCase()),
    ),
  };
  return NextResponse.json(scoped);
});
