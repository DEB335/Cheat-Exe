import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { matchBan } from "./bans";
import { accountBlock, readDb } from "./db";
import { lockedToAnotherDevice } from "./device-lock";
import { deviceIdentity } from "./device";
import { SESSION_COOKIE, readSessionToken } from "./session";
import type { Database, SessionUser } from "./types";

/** Current session, or null. Route handlers should prefer requireUser. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * One read per request, shared by every caller in it. Without this the
 * account check below would double the query count on routes that go on
 * to read the database themselves.
 */
export const loadDb = cache(async (): Promise<Database> => readDb());

const BLOCK_MESSAGE = {
  banned: "Your account has been terminated.",
  suspended: "Your account has been suspended.",
  pending: "Your account is still pending approval.",
  expired: "Your account validity has ended.",
  deleted: "This account no longer exists.",
} as const;

/**
 * Authenticates *and* re-checks that the account is still usable.
 *
 * A signed cookie proves who you were when you signed in, not that the
 * owner still wants you here. Suspending a reseller used to leave their
 * open tab fully working until the token expired; every authenticated
 * route runs through here, so it now stops at the next request.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not authenticated");

  const db = await loadDb();

  const blocked = accountBlock(db, user.username, user.role);
  if (blocked) throw new HttpError(403, BLOCK_MESSAGE[blocked]);

  // Same carve-out as the login route: a device block never applies to
  // the owner, so lifting one is always possible from any machine.
  if (user.role !== "OWNER") {
    const { hwid, fingerprint } = await deviceIdentity();
    const marks = { ip: await clientIp(), hwid, fingerprint };

    if (matchBan(db, marks)) {
      throw new HttpError(403, "This device has been blocked.");
    }
    // Catches a session that was valid when it opened and then had its
    // lock reset and re-claimed by a different machine.
    if (lockedToAnotherDevice(db, user.username, marks)) {
      throw new HttpError(403, "This account is locked to another device.");
    }
  }

  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new HttpError(403, "Owner access required");
  return user;
}

/** Best-effort client IP from the proxy headers, for the audit log. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "127.0.0.1";
}

export async function userAgent(): Promise<string> {
  const h = await headers();
  return h.get("user-agent") ?? "";
}
