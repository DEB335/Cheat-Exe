import { NextResponse } from "next/server";

import { clientIp, getSessionUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { matchBan } from "@/lib/bans";
import { accountBlock, readDb } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * Returns the current session, terminating it when the account can no
 * longer be used. This is what the dashboard polls, so a suspension, a
 * ban, a kick or a fresh device block lands within one poll instead of
 * waiting out the twelve-hour token.
 */
export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const db = await readDb();
  const { hwid, fingerprint } = await deviceIdentity();

  const blocked = accountBlock(db, user.username, user.role);
  const kicked = !db.cheatExeDevices.some((d) => d.sessionId === user.sessionId);
  // The owner is exempt from device blocks -- see resolveLogin.
  const rule =
    user.role === "OWNER" ? null : matchBan(db, { ip: await clientIp(), hwid, fingerprint });

  const terminated = blocked ?? (rule ? "device" : kicked ? "kicked" : null);

  if (terminated) {
    const response = NextResponse.json({ user: null, terminated });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
  }

  return NextResponse.json({ user });
});
