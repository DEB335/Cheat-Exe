import { NextResponse } from "next/server";

import { clientIp, getSessionUser } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { displayUser } from "@/lib/utils";

export const POST = route(async () => {
  const user = await getSessionUser();
  const ip = await clientIp();

  if (user) {
    await updateDb((db) => {
      db.cheatExeDevices = db.cheatExeDevices.filter((d) => d.sessionId !== user.sessionId);
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action:
          user.role === "OWNER" ? "Owner logged out successfully" : "Logged out successfully",
        ip,
      });
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
});
