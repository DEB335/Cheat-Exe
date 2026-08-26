import { NextResponse } from "next/server";

import { HttpError, clientIp, userAgent } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { DEVICE_COOKIE, deviceCookieOptions, deviceIdentity } from "@/lib/device";
import { LOGIN_ERROR, resolveLogin } from "@/lib/login";
import { rateLimit } from "@/lib/rate-limit";
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
  const { hwid, fingerprint } = await deviceIdentity();
  const sessionId = newSessionId();

  // Twenty real sign-in attempts a minute from one address is already
  // generous for a panel this size.
  const limit = rateLimit(`login:${ip}`, 20, 60_000);
  if (!limit.ok) {
    throw new HttpError(429, `Too many attempts. Try again in ${limit.retryAfter}s.`);
  }

  const session = await updateDb(async (db): Promise<SessionUser> => {
    const outcome = await resolveLogin(db, user, password, { ip, hwid, fingerprint });

    if (!outcome.ok) {
      if (outcome.reason === "invalid") {
        throw new HttpError(401, "Invalid username or credentials!");
      }
      throw new HttpError(403, LOGIN_ERROR[outcome.reason]);
    }

    const resolved: SessionUser = {
      username: outcome.username,
      role: outcome.role,
      packages: outcome.packages,
      sessionId,
    };

    pushAudit(db, {
      user: displayUser(resolved.username, resolved.role),
      action: resolved.role === "OWNER" ? "Owner logged in successfully" : "Logged in successfully",
      ip,
    });

    // Register this device session.
    db.cheatExeDevices.unshift({
      sessionId,
      user: displayUser(resolved.username, resolved.role),
      ip,
      device,
      timestamp: formatTimestamp(),
      hwid,
      fingerprint,
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
  // Re-set on every login so the device id keeps rolling forward its year.
  response.cookies.set(DEVICE_COOKIE, hwid, deviceCookieOptions);
  return response;
});
