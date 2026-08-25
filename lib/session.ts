import { SignJWT, jwtVerify } from "jose";

import type { SessionUser } from "./types";

export const SESSION_COOKIE = "cheatexe_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a random 32+ character value in .env.local.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role,
    packages: user.packages,
    sessionId: user.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.username !== "string") return null;
    if (payload.role !== "OWNER" && payload.role !== "RESELLER") return null;
    return {
      username: payload.username,
      role: payload.role,
      packages: Array.isArray(payload.packages) ? (payload.packages as string[]) : [],
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : "",
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
} as const;
