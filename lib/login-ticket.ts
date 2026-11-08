import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A receipt for a password the server has already checked.
 *
 * The sign-in button asks /api/auth/verify about the typed pair before it
 * lights up, and that check is a bcrypt comparison -- the slow part of
 * signing in. The login itself then made the same comparison again, so
 * every sign-in paid for bcrypt twice, the second time while the person
 * was watching the button. When verify says yes it now hands back this
 * ticket, and the login accepts it in place of the second comparison.
 *
 * The ticket holds no password-derived bytes in the clear: the payload is
 * just the account name and an expiry, and everything else lives inside
 * the MAC -- keyed with SESSION_SECRET over the account, the expiry, the
 * stored hash, the typed password and the device id. So it only stands in
 * for bcrypt when the login carries the very password verify checked,
 * against the hash still on file (a password changed in between voids
 * it), from the same browser, within two minutes. Anything else falls
 * back to bcrypt, which is always correct; the ticket only ever makes a
 * login faster, never possible where it was not.
 */
export const TICKET_COOKIE = "cheatexe_preauth";

const TICKET_LIFETIME_SECONDS = 120;

/** Separates this MAC from anything else signed with the same secret. */
const DOMAIN = "cheatexe-preauth-v1";

export const ticketCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  // Only the login route ever reads it.
  path: "/api/auth/login",
  maxAge: TICKET_LIFETIME_SECONDS,
} as const;

/** The same cookie, spent. */
export const clearedTicketCookieOptions = { ...ticketCookieOptions, maxAge: 0 } as const;

interface TicketClaims {
  /** The account's canonical name: the owner's stored name or the reseller key. */
  account: string;
  /** The hash the password was checked against. */
  hash: string;
  password: string;
  hwid: string;
}

/**
 * The key, or null when there is no real one. Session tokens fall back to
 * a built-in secret when SESSION_SECRET is unset (lib/session.ts); a
 * ticket never does -- with no proper secret there are simply no
 * tickets, and every sign-in pays its bcrypt as before.
 */
function secret(): string | null {
  const value = process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

/**
 * JSON.stringify of an array, not a joined string: no field can contain
 * a separator that shifts the boundary between two others.
 */
function mac(claims: TicketClaims, expires: number): Buffer | null {
  const key = secret();
  if (!key) return null;
  const message = JSON.stringify([
    DOMAIN,
    claims.account,
    expires,
    claims.hash,
    claims.password,
    claims.hwid,
  ]);
  return createHmac("sha256", key).update(message).digest();
}

/** A ticket for these claims, or null when tickets are off (no secret). */
export function issueTicket(claims: TicketClaims): string | null {
  const expires = Math.floor(Date.now() / 1000) + TICKET_LIFETIME_SECONDS;
  const signature = mac(claims, expires);
  if (!signature) return null;
  const payload = Buffer.from(JSON.stringify({ a: claims.account, e: expires })).toString(
    "base64url",
  );
  return `${payload}.${signature.toString("base64url")}`;
}

/**
 * Whether `ticket` vouches for exactly these claims, right now.
 *
 * Never throws: a malformed, expired or foreign ticket is simply not a
 * receipt, and the caller goes on to bcrypt.
 */
export function ticketVouches(ticket: string | undefined, claims: TicketClaims): boolean {
  if (!ticket) return false;
  try {
    const [payload, signature] = ticket.split(".");
    if (!payload || !signature) return false;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      a?: unknown;
      e?: unknown;
    };
    if (parsed.a !== claims.account || typeof parsed.e !== "number") return false;

    const now = Math.floor(Date.now() / 1000);
    // Expired, or claiming a lifetime no ticket from here was ever given.
    if (parsed.e <= now || parsed.e > now + TICKET_LIFETIME_SECONDS + 5) return false;

    const expected = mac(claims, parsed.e);
    if (!expected) return false;
    const given = Buffer.from(signature, "base64url");
    return given.length === expected.length && timingSafeEqual(given, expected);
  } catch {
    return false;
  }
}
