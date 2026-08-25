import { NextResponse } from "next/server";

import { HttpError, clientIp, userAgent } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, updateDb, verifyPassword } from "@/lib/db";
import { PACKAGE_NAMES } from "@/lib/packages";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import type { SessionUser } from "@/lib/types";
import { describeDevice, displayUser, formatTimestamp, newSessionId } from "@/lib/utils";

interface LoginBody {
  username?: string;
  password?: string;
}

export const POST = route(async (request: Request) => {
  const { username = "", password = "" } = await readJson<LoginBody>(request);
  const user = username.trim();

  if (!user || !password) {
    throw new HttpError(400, "Enter both a username and a password.");
  }

  const ip = await clientIp();
  const device = describeDevice(await userAgent());
  const sessionId = newSessionId();

  const session = await updateDb(async (db): Promise<SessionUser> => {
    const banned = db.cheatExeBannedUsers.some(
      (b) => b.username.toLowerCase() === user.toLowerCase(),
    );
    const isOwnerName = user.toLowerCase() === db.adminUser.toLowerCase();

    if (banned && !isOwnerName) {
      throw new HttpError(403, "BANNED");
    }

    let resolved: SessionUser | null = null;

    if (isOwnerName && (await verifyPassword(password, db.adminPassHash))) {
      resolved = { username: db.adminUser, role: "OWNER", packages: PACKAGE_NAMES, sessionId };
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: "Owner logged in successfully",
        ip,
      });
    } else {
      const match = findReseller(db, user);
      if (!match || !(await verifyPassword(password, match.user.pass))) {
        // Same message for unknown user and wrong password -- do not
        // let the response reveal which usernames exist.
        throw new HttpError(401, "Invalid username or credentials!");
      }
      if (match.user.status !== "ACTIVE") {
        throw new HttpError(403, "Account pending or suspended!");
      }
      resolved = {
        username: match.key,
        role: "RESELLER",
        packages: match.user.packages ?? [],
        sessionId,
      };
      pushAudit(db, {
        user: `${match.key} (RESELLER)`,
        action: "Logged in successfully",
        ip,
      });
    }

    // Register this device session.
    db.cheatExeDevices.unshift({
      sessionId,
      user: displayUser(resolved.username, resolved.role),
      ip,
      device,
      timestamp: formatTimestamp(),
    });
    if (db.cheatExeDevices.length > 50) db.cheatExeDevices.pop();

    return resolved;
  });

  const token = await createSessionToken(session);
  const response = NextResponse.json({
    success: true,
    user: session,
    message: session.role === "OWNER" ? "Owner Login successful" : "Reseller Login successful",
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
});
