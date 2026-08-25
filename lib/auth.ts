import "server-only";

import { cookies, headers } from "next/headers";

import { SESSION_COOKIE, readSessionToken } from "./session";
import type { SessionUser } from "./types";

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

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not authenticated");
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
