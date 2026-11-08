import { NextResponse } from "next/server";

import { clientIp } from "@/lib/auth";
import { readJson, route } from "@/lib/api-helpers";
import { readSliceWithHash, verifyPassword } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { LOGIN_FIELDS, resolveLogin, type LoginReason } from "@/lib/login";
import { TICKET_COOKIE, issueTicket, ticketCookieOptions } from "@/lib/login-ticket";
import { rateLimit } from "@/lib/rate-limit";

interface VerifyBody {
  username?: string;
  password?: string;
}

/**
 * Answers "would this pair sign in?" without creating a session.
 *
 * The sign-in button only turns green and holds still once the typed
 * credentials are real, and the browser cannot be trusted to decide
 * that -- the original compared against localStorage, which anyone
 * could edit. So the check runs here.
 *
 * That makes this endpoint a credential oracle by design, which is why
 * it is rate limited harder than the login route itself, never says
 * *which* half was wrong, and writes nothing to the database: no
 * session, no device row, no audit entry.
 *
 * A yes does leave one cookie behind, for the login that usually follows
 * within a second: a pre-auth ticket that lets it skip a second bcrypt
 * comparison (lib/login-ticket.ts). Only for a browser that already has
 * a device id, because the ticket is bound to it -- and this route never
 * sets one itself. The login does that, and binds a locked account to
 * it; a verify reply landing after a login on a fresh browser would
 * otherwise overwrite the id the lock was just bound to, and the reseller
 * would be told they are on the wrong machine.
 */
export const POST = route(async (request: Request) => {
  const { username = "", password = "" } = await readJson<VerifyBody>(request);
  const ip = await clientIp();

  // The limit stays low because this is a credential oracle -- it must not
  // become a faster brute-force channel than the login route. When it does
  // trip, the answer is "retry", not "wrong": a throttled check says
  // nothing about the credentials, and `retryAfter` lets the button wait
  // and try again rather than flashing an error mid-typing.
  const limit = rateLimit(`verify:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, retry: true, retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  if (!username.trim() || !password) {
    return NextResponse.json({ ok: false, reason: "invalid" satisfies LoginReason });
  }

  const { hwid, fingerprint, isNew } = await deviceIdentity();
  // Only the fields the decision reads: the key history and audit log,
  // most of the document, never leave the database for a check.
  const db = await readSliceWithHash(LOGIN_FIELDS);

  // Which stored hash the password matched, if any -- the ticket is bound
  // to it, so a password reset before the login voids the ticket.
  const matched: { receipt: { hash: string; account: string } | null } = { receipt: null };
  const outcome = await resolveLogin(
    db,
    username,
    password,
    { ip, hwid, fingerprint },
    async (hash, account) => {
      const ok = await verifyPassword(password, hash);
      if (ok) matched.receipt = { hash, account };
      return ok;
    },
  );

  // Only ever ok/reason -- no username, role or package list leaks from
  // an endpoint that runs before authentication.
  const response = NextResponse.json(
    outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason },
    { headers: { "Cache-Control": "no-store" } },
  );

  // A freshly minted id (`isNew`) exists only in this response and would
  // never come back, so a ticket bound to it could not vouch for anything.
  const receipt = matched.receipt;
  if (outcome.ok && receipt && !isNew) {
    const ticket = issueTicket({ account: receipt.account, hash: receipt.hash, password, hwid });
    if (ticket) response.cookies.set(TICKET_COOKIE, ticket, ticketCookieOptions);
  }

  return response;
});
