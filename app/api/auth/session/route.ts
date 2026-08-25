import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { readDb } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * Returns the current session. A session whose account was banned or
 * kicked while it was open is terminated here, which is what the old
 * checkBannedOnDashboard poll did client-side.
 */
export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const db = await readDb();
  const banned = db.cheatExeBannedUsers.some(
    (b) => b.username.toLowerCase() === user.username.toLowerCase(),
  );
  const kicked = !db.cheatExeDevices.some((d) => d.sessionId === user.sessionId);

  if (banned || kicked) {
    const response = NextResponse.json({
      user: null,
      terminated: banned ? "banned" : "kicked",
    });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
  }

  return NextResponse.json({ user });
});
