import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { ACCESS_FIELDS, asDatabase, clientIp, livePackages } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { matchBan } from "@/lib/bans";
import { accountBlock, findReseller, getDbUpdatedAt, readSlice, updateDb } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { unreadFor } from "@/lib/messages";
import { lockedToAnotherDevice } from "@/lib/device-lock";
import { SESSION_COOKIE, createSessionToken, readSessionState, sessionCookieOptions } from "@/lib/session";
import { SESSION_LIFETIME_MINUTES } from "@/lib/session-lifetime";
import type { SessionUser } from "@/lib/types";
import { displayUser } from "@/lib/utils";

/** Clears the cookie and answers with the reason the session ended. */
function ended(terminated: string): NextResponse {
  const response = NextResponse.json({ user: null, terminated });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}

/**
 * Closes out a session that has reached its fixed lifetime.
 */
async function timedOut(user: SessionUser, ip: string): Promise<NextResponse> {
  await updateDb((db) => {
    db.cheatExeDevices = db.cheatExeDevices.filter((d) => d.sessionId !== user.sessionId);
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Session expired after ${SESSION_LIFETIME_MINUTES} minutes of inactivity`,
      ip,
    });
  });
  return ended("timeout");
}

export const GET = route(async (req: NextRequest) => {
  const store = await cookies();
  const state = await readSessionState(store.get(SESSION_COOKIE)?.value);

  if (state.status === "expired") return timedOut(state.user, await clientIp());
  if (state.status !== "valid") return NextResponse.json({ user: null });

  const user = state.user;
  const db = await readSlice([...ACCESS_FIELDS, "cheatExeDevices", "cheatExeMessages"]);
  const { hwid, fingerprint } = await deviceIdentity();

  const blocked = accountBlock(db, user.username, user.role);
  const kicked = !db.cheatExeDevices.some((d) => d.sessionId === user.sessionId);
  const marks = { ip: await clientIp(), hwid, fingerprint };
  const rule = user.role === "OWNER" ? null : matchBan(asDatabase(db), marks);
  const locked =
    user.role !== "OWNER" && lockedToAnotherDevice(asDatabase(db), user.username, marks);

  const terminated =
    blocked ?? (rule ? "device" : locked ? "locked" : kicked ? "kicked" : null);

  if (terminated) return ended(terminated);

  const resellerRec = user.role === "RESELLER" ? findReseller(asDatabase(db), user.username)?.user : null;
  const response = NextResponse.json({
    user: {
      ...user,
      packages: livePackages(db, user),
      uidBypassAccess: user.role === "OWNER" ? true : Boolean(resellerRec?.uidBypassAccess),
      emulatorBypassAccess: user.role === "OWNER" ? true : Boolean(resellerRec?.emulatorBypassAccess),
      emulatorCredits: user.role === "OWNER" ? 999999 : (resellerRec?.emulatorCredits ?? 0),
      emulatorAllowedDays: user.role === "OWNER" ? [1, 3, 7, 30, 60, 90, 180, 365] : (resellerRec?.emulatorAllowedDays ?? [1, 3, 7]),
    },
    unread: unreadFor(db.cheatExeMessages, user.username),
    updatedAt: await getDbUpdatedAt(),
  });

  // Sliding session renewal: if touched while the user is actively working, refresh token
  const url = new URL(req.url);
  if (url.searchParams.get("touch") === "1") {
    const refreshedToken = await createSessionToken(user);
    response.cookies.set(SESSION_COOKIE, refreshedToken, sessionCookieOptions);
  }

  return response;
});

