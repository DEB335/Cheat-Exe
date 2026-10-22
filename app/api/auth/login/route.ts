import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { HttpError, clientIp, userAgent } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { expireOverdue, findReseller, ownerHashIn, readSliceWithHash, updateSlice } from "@/lib/db";
import { DEVICE_COOKIE, deviceCookieOptions, deviceIdentity } from "@/lib/device";
import { bindDevice } from "@/lib/device-lock";
import {
  LOGIN_ERROR,
  LOGIN_FIELDS,
  isOwnerLogin,
  memoizedCheck,
  resolveLogin,
  type LoginOutcome,
} from "@/lib/login";
import {
  TICKET_COOKIE,
  clearedTicketCookieOptions,
  ticketVouches,
} from "@/lib/login-ticket";
import { rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import type { SessionUser } from "@/lib/types";
import { describeDevice, displayUser, formatTimestamp, newSessionId } from "@/lib/utils";

interface LoginBody {
  username?: string;
  password?: string;
}

/**
 * What a sign-in writes: the account checks' fields, which it also
 * changes (expiry bookkeeping, the device lock), plus the device list and
 * the audit log. Never the key history, which is most of the document and
 * which a sign-in has no business reading, let alone rewriting.
 */
const WRITE_FIELDS = [...LOGIN_FIELDS, "cheatExeDevices", "cheatExeAuditLogs"] as const;

/** Thrown out of the sign-in transaction to retry it with a derived owner hash. */
const NEEDS_LEGACY_HASH = Symbol("needs legacy hash");

/** Turns a refusal into the error the login page switches on. */
function refuse(outcome: Exclude<LoginOutcome, { ok: true }>): never {
  if (outcome.reason === "invalid") {
    throw new HttpError(401, "Invalid username or credentials!");
  }
  throw new HttpError(403, LOGIN_ERROR[outcome.reason]);
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
  const marks = { ip, hwid, fingerprint };
  const sessionId = newSessionId();

  // Twenty real sign-in attempts a minute from one address is already
  // generous for a panel this size.
  const limit = rateLimit(`login:${ip}`, 20, 60_000);
  if (!limit.ok) {
    throw new HttpError(429, `Too many attempts. Try again in ${limit.retryAfter}s.`);
  }

  // The live check behind the button already ran bcrypt on this exact
  // pair and left a ticket saying so; when it is still good, it stands in
  // for a second comparison. Otherwise -- no check yet, because the
  // button was pressed while it was still asking, or a ticket from
  // another device or an older password -- bcrypt runs as it always did.
  const ticket = (await cookies()).get(TICKET_COOKIE)?.value;
  const check = memoizedCheck(password, (hash, account) =>
    ticketVouches(ticket, { account, hash, password, hwid }),
  );

  // With the file store, a first pass against an unlocked read, so the
  // password comparison -- bcrypt, when there is no ticket -- never runs
  // inside its write queue; a refusal there is final, since the write
  // below would have written nothing for it either. With Postgres the
  // transaction's own locked read is the only read: an unlocked pass
  // first would cost a round trip of its own, ~135ms on the live site, to
  // spare the lock one bcrypt that a ticket usually spares anyway.
  const unlocked = process.env.DATABASE_URL ? null : await readSliceWithHash(LOGIN_FIELDS);
  if (unlocked) {
    const early = await resolveLogin(unlocked, user, password, marks, check);
    if (!early.ok) refuse(early);
  }

  const signIn = (legacyHash: string) => updateSlice(WRITE_FIELDS, async (db, tx): Promise<SessionUser> => {
    // Stamp any account whose validity has lapsed, so the reseller table
    // reads EXPIRED rather than a stale ACTIVE. Access does not depend on
    // this -- resolveLogin computes expiry itself -- it is bookkeeping.
    expireOverdue(db);

    // The owner's hash is not part of the slice (see readSliceWithHash),
    // so it is read here, on this transaction, under the same lock -- and
    // only for the owner's name; a reseller's sign-in never looks at it.
    //
    // A document still carrying the plaintext password has no hash on
    // file. The first pass already derived one from that same plaintext,
    // and nothing can have changed it since without writing a real hash,
    // so that one is reused -- the same string, which the memoized check
    // already holds an answer for. Re-deriving it here would mean a read
    // on a second pool connection while this one holds the row lock, and
    // a fresh salt the memo would miss.
    // ownerHashIn reads on `tx` -- or the file store's copy when there is
    // no database and so no transaction.
    let adminPassHash = "";
    if (isOwnerLogin(db.adminUser, user)) {
      adminPassHash = (await ownerHashIn(tx)) || unlocked?.adminPassHash || legacyHash;
      // Postgres with no hash on file: a document still carrying the
      // plaintext password. Only readSliceWithHash knows how to derive
      // one, and it must not run on the pool while this holds the lock,
      // so the transaction is abandoned and retried below with it.
      if (!adminPassHash) throw NEEDS_LEGACY_HASH;
    }

    // Authoritative pass, against the locked state. The checker answers
    // from the first pass for an unchanged hash, so this costs no second
    // bcrypt -- and a hash that changed in between is checked afresh.
    const outcome = await resolveLogin({ ...db, adminPassHash }, user, password, marks, check);
    if (!outcome.ok) refuse(outcome);

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

    // A locked account claims its device here, on the first sign-in after
    // the owner switched the lock on. resolveLogin has already refused
    // anyone arriving at an account bound to a different machine.
    if (resolved.role === "RESELLER") {
      const match = findReseller(db, resolved.username);
      if (match && bindDevice(match.user, marks, formatTimestamp())) {
        pushAudit(db, {
          user: displayUser(resolved.username, resolved.role),
          action: `Device locked to this machine (${device})`,
          ip,
        });
      }
    }

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

    // Deliberately no ping("device", tx) here. A sign-in is routine and
    // frequent -- unlike a kick or a suspension, which are rare and
    // owner-initiated -- and every ping wakes every open dashboard into a
    // full /api/db refetch (see the coalescing comment in use-realtime.ts,
    // which measured a single burst producing six refetches against a
    // three-connection pool). Broadcasting one of those per login would
    // make the realtime channel noisy in proportion to reseller traffic
    // rather than to owner-relevant events, for a page -- Active Devices --
    // where "current within five seconds" (the existing poll) is already
    // fine. Logouts below are symmetric for the same reason.
    return resolved;
  });

  let session: SessionUser;
  try {
    session = await signIn("");
  } catch (err) {
    if (err !== NEEDS_LEGACY_HASH) throw err;
    session = await signIn((await readSliceWithHash(LOGIN_FIELDS)).adminPassHash);
  }

  const token = await createSessionToken(session);
  const response = NextResponse.json({
    success: true,
    user: session,
    message: session.role === "OWNER" ? "Owner Login successful" : "Reseller Login successful",
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  // Re-set on every login so the device id keeps rolling forward its year.
  response.cookies.set(DEVICE_COOKIE, hwid, deviceCookieOptions);
  // Spent: a ticket vouches for one sign-in, not for the next two minutes.
  response.cookies.set(TICKET_COOKIE, "", clearedTicketCookieOptions);
  return response;
});
