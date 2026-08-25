import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { hashPassword, updateDb } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { PACKAGE_NAMES } from "@/lib/packages";

interface ProfileBody {
  username?: string;
  password?: string;
  displayName?: string;
  avatar?: string;
  banner?: string;
}

/** Only http(s) URLs -- an avatar field should not become an XSS vector. */
function safeUrl(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, `${field} must be a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, `${field} must be an http or https URL.`);
  }
  return trimmed;
}

/**
 * Owner profile: display name, avatar, banner, and the owner's own
 * credentials. Changing the username or password reissues the session
 * cookie so the caller is not logged out by their own edit.
 */
export const PATCH = route(async (request: Request) => {
  const owner = await requireOwner();
  const body = await readJson<ProfileBody>(request);

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username) throw new HttpError(400, "Username and Password cannot be empty!");
  if (!password) throw new HttpError(400, "Username and Password cannot be empty!");
  if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters.");

  const avatar = safeUrl(body.avatar ?? "", "Avatar image URL");
  const banner = safeUrl(body.banner ?? "", "Banner image URL");
  const displayName = (body.displayName ?? "").trim() || "Cheat Exe";
  const hash = await hashPassword(password);
  const ip = await clientIp();

  await updateDb((db) => {
    db.adminUser = username;
    db.adminPassHash = hash;
    db.profile = {
      displayName,
      avatar: avatar || db.profile.avatar,
      banner: banner || db.profile.banner,
    };
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Updated owner profile settings",
      ip,
    });
  });

  // The username is part of the session payload, so mint a fresh cookie.
  const token = await createSessionToken({
    username,
    role: "OWNER",
    packages: PACKAGE_NAMES,
    sessionId: owner.sessionId,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
});
