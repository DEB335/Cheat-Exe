import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clientIp, livePackages, loadDb } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { matchBan } from "@/lib/bans";
import { accountBlock, updateDb } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { unreadFor } from "@/lib/messages";
import { lockedToAnotherDevice } from "@/lib/device-lock";
import { SESSION_COOKIE, readSessionState, sessionCookieOptions } from "@/lib/session";
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
 *
 * The device row goes with it, exactly as it does on an explicit sign-out:
 * a timed-out session can no longer do anything, and leaving it in Active
 * Devices would show the owner a machine that is not actually connected.
 * Nothing downstream breaks if one does survive -- every login mints a
 * fresh sessionId with its own row, so the `kicked` check below cannot
 * mistake a dead row for the live session -- it is purely that the list
 * should mean what it says.
 */
async function timedOut(user: SessionUser, ip: string): Promise<NextResponse> {
  await updateDb((db) => {
    db.cheatExeDevices = db.cheatExeDevices.filter((d) => d.sessionId !== user.sessionId);
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Session expired after ${SESSION_LIFETIME_MINUTES} minutes`,
      ip,
    });
  });
  return ended("timeout");
}

/**
 * Returns the current session, terminating it when the account can no
 * longer be used. This is what the dashboard polls, so a suspension, a
 * ban, a kick or a fresh device block lands within one poll instead of
 * waiting out the token.
 *
 * Note what this deliberately does not do: renew anything. The session
 * ends a fixed twenty minutes after sign-in, so being here -- however
 * busy the panel is -- buys no extra time. Shell runs its own timer for
 * the deadline itself; this is the path that catches a session which is
 * already over.
 */
export const GET = route(async () => {
  const store = await cookies();
  const state = await readSessionState(store.get(SESSION_COOKIE)?.value);

  if (state.status === "expired") return timedOut(state.user, await clientIp());
  if (state.status !== "valid") return NextResponse.json({ user: null });

  const user = state.user;
  // loadDb rather than readDb: this handler reads the database twice
  // -- once for the checks, once for the grants below -- and the cache
  // keeps a poll running every five seconds from doubling its queries.
  const db = await loadDb();
  const { hwid, fingerprint } = await deviceIdentity();

  const blocked = accountBlock(db, user.username, user.role);
  const kicked = !db.cheatExeDevices.some((d) => d.sessionId === user.sessionId);
  // The owner is exempt from device blocks and locks -- see resolveLogin.
  const marks = { ip: await clientIp(), hwid, fingerprint };
  const rule = user.role === "OWNER" ? null : matchBan(db, marks);
  const locked =
    user.role !== "OWNER" && lockedToAnotherDevice(db, user.username, marks);

  const terminated =
    blocked ?? (rule ? "device" : locked ? "locked" : kicked ? "kicked" : null);

  if (terminated) return ended(terminated);

  // Rides along on the poll the dashboard already runs, so a new
  // announcement surfaces within one tick without a second request.
  //
  // The grants are resolved from the account record for the same reason,
  // and it is the poll that makes revoking one reliable. A permission
  // change does ping, and the ping is far quicker -- but realtime is an
  // accelerator here, not the mechanism, and a reseller keeping a section
  // they no longer hold because a socket dropped is exactly the kind of
  // failure the poll exists to cover.
  return NextResponse.json({
    user: { ...user, packages: livePackages(db, user) },
    unread: unreadFor(db.cheatExeMessages, user.username),
  });
});
