import { SignJWT, jwtVerify } from "jose";

import { SESSION_LIFETIME_SECONDS } from "./session-lifetime";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "cheatexe_session";

export { SESSION_LIFETIME_SECONDS } from "./session-lifetime";

/**
 * The cookie deliberately outlives the token inside it.
 *
 * If the two ran out together the browser would drop the cookie the
 * moment the session ended, the server would see a plain anonymous
 * request, and the panel could only say "you are not signed in" -- the
 * same blank answer a first-time visitor gets. Keeping the spent cookie
 * a while longer is what lets the session route recognise *this* session
 * as one that hit its limit and say so. Access is granted by the token's
 * own expiry, never by the cookie; one that outlives its token is an
 * inert string that every check below rejects.
 */
const COOKIE_MAX_AGE = SESSION_LIFETIME_SECONDS + 60 * 60;

/**
 * Verify the signature, but leave `exp` for us to judge.
 *
 * jose reports an expired token as a verification failure, which throws
 * the payload away along with it -- and the payload is how we know whose
 * session just ended and which device row to retire. A tolerance this
 * wide never rejects on age, so a bad signature stays the only thing
 * that can fail, and the expiry check below is then ours to make.
 */
const IGNORE_EXPIRY = { clockTolerance: 60 * 60 * 24 * 365 };

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a random 32+ character value in .env.local.",
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * Signs a session cookie.
 *
 * `deadline` is what makes the twenty minutes an actual ceiling. A token
 * sometimes has to be re-signed mid-session -- the owner renaming their
 * own account is the one case, since the username is part of the payload
 * -- and a re-signed token that started a fresh window would hand out an
 * unlimited extension to anyone willing to re-save their profile every
 * quarter of an hour. Re-issues pass the deadline they already had, so
 * the new cookie expires exactly when the old one would have.
 */
export async function createSessionToken(user: SessionUser, deadline?: number): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role,
    packages: user.packages,
    sessionId: user.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(deadline ?? `${SESSION_LIFETIME_SECONDS}s`)
    .sign(secret());
}

/**
 * What the cookie on this request turned out to be.
 *
 * `expired` still carries the user: the signature checked out, so the
 * claims are trustworthy even though the session is over, and the
 * session route needs them to name the session it is retiring.
 */
export type SessionState =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "expired"; user: SessionUser }
  | { status: "valid"; user: SessionUser; expiresAt: number };

function toUser(payload: Record<string, unknown>): SessionUser | null {
  if (typeof payload.username !== "string") return null;
  if (payload.role !== "OWNER" && payload.role !== "RESELLER") return null;
  return {
    username: payload.username,
    role: payload.role,
    packages: Array.isArray(payload.packages) ? (payload.packages as string[]) : [],
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : "",
  };
}

export async function readSessionState(token: string | undefined): Promise<SessionState> {
  if (!token) return { status: "none" };

  try {
    const { payload } = await jwtVerify(token, secret(), IGNORE_EXPIRY);
    const user = toUser(payload as Record<string, unknown>);
    if (!user) return { status: "invalid" };

    // A token with no expiry claim at all is treated as already over
    // rather than as unlimited -- the safe direction for a rule whose
    // entire point is that nothing outlives the window.
    const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
    if (expiresAt * 1000 <= Date.now()) return { status: "expired", user };

    return { status: "valid", user, expiresAt };
  } catch {
    return { status: "invalid" };
  }
}

/**
 * The session behind this cookie, or null for anything that is not a
 * live one. Everything that only needs "may this request proceed"
 * -- requireUser, the dashboard layout -- goes through here; only the
 * session route cares *why* a cookie failed.
 */
export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  const state = await readSessionState(token);
  return state.status === "valid" ? state.user : null;
}

/** Whole seconds left before `deadline`, never negative. */
export function secondsUntil(deadline: number): number {
  return Math.max(0, Math.round(deadline - Date.now() / 1000));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
} as const;
