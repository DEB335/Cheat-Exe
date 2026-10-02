import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { matchBan } from "./bans";
import { accountBlock, findReseller, readDb, readSlice } from "./db";
import { lockedToAnotherDevice } from "./device-lock";
import { deviceIdentity } from "./device";
import { PACKAGE_NAMES } from "./packages";
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
 * The whole document, read once per server-component render.
 *
 * Only once per *render*: React's cache keys on the render in progress,
 * and a route handler has none, so there every call is a fresh query.
 * A route that needs both the checks and the whole document should take
 * them from requireUserWithDb, which does both off one read.
 */
export const loadDb = cache(async (): Promise<Database> => readDb());

/**
 * What requireUser's checks read: the owner's name, the reseller
 * records, the banned vault and the device ban list. Nothing else, so
 * the key history and the audit log -- which are most of the document --
 * stay in the database on every authenticated request.
 */
export const ACCESS_FIELDS = [
  "adminUser",
  "cheatExeUsers",
  "cheatExeBannedUsers",
  "cheatExeBans",
] as const;

export type AccessState = Pick<Database, (typeof ACCESS_FIELDS)[number]>;

const loadAccess = cache(async (): Promise<AccessState> => readSlice(ACCESS_FIELDS));

/**
 * matchBan and lockedToAnotherDevice take the whole Database but read
 * only the ban list and the reseller records, which every slice from
 * ACCESS_FIELDS carries. The fields a slice leaves out are absent, not
 * empty: if either function ever starts reading one, it throws and the
 * request is refused, rather than passing because a list came back
 * empty.
 */
export function asDatabase(state: AccessState): Database {
  return state as Database;
}

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
  return (await authorize(loadAccess)).user;
}

/**
 * requireUser for a route that goes on to read the whole document
 * anyway. The checks run against that one read, where requireUser
 * followed by loadDb would query twice -- loadDb's cache does not reach
 * into route handlers.
 */
export async function requireUserWithDb(): Promise<{ user: SessionUser; db: Database }> {
  return authorize(readDb);
}

/** The checks behind both of the above, against whichever read they hand it. */
async function authorize<T extends AccessState>(
  load: () => Promise<T>,
): Promise<{ user: SessionUser; db: T }> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not authenticated");

  const db = await load();
  // Same reasoning as the block check below, one field over. `packages`
  // is a copy taken at sign-in and signed into the token, so a grant the
  // owner revoked mid-session stayed in force for the rest of that
  // token's life -- and for the UID whitelist that is not a cosmetic
  // stale menu, it is a reseller still able to spend credits on a
  // package they no longer hold. Every authenticated route resolves its
  // permissions here, from the database, so a revocation lands on the
  // next request.
  const live: SessionUser = { ...user, packages: livePackages(db, user) };

  const blocked = accountBlock(db, user.username, user.role);
  if (blocked) throw new HttpError(403, BLOCK_MESSAGE[blocked]);

  // Same carve-out as the login route: a device block never applies to
  // the owner, so lifting one is always possible from any machine.
  if (user.role !== "OWNER") {
    const { hwid, fingerprint } = await deviceIdentity();
    const marks = { ip: await clientIp(), hwid, fingerprint };

    if (matchBan(asDatabase(db), marks)) {
      throw new HttpError(403, "This device has been blocked.");
    }
    // Catches a session that was valid when it opened and then had its
    // lock reset and re-claimed by a different machine.
    if (lockedToAnotherDevice(asDatabase(db), user.username, marks)) {
      throw new HttpError(403, "This account is locked to another device.");
    }
  }

  return { user: live, db };
}

/**
 * The grants this account holds right now, rather than at sign-in.
 *
 * The owner is not a reseller and has no record to read, so they hold
 * everything -- the same answer resolveLogin gives them. A reseller
 * whose record has since been deleted holds nothing; accountBlock will
 * have already turned that request away, and answering with an empty
 * list rather than the token's copy keeps this honest if it is ever
 * called somewhere that has not made that check.
 */
export function livePackages(db: Pick<Database, "cheatExeUsers">, user: SessionUser): string[] {
  if (user.role === "OWNER") return PACKAGE_NAMES;
  return findReseller(db, user.username)?.user.packages ?? [];
}

/**
 * The session for a server component, with permissions as they stand
 * now. Route handlers get this from requireUser; a layout that only
 * needs to render cannot use that, since it throws rather than
 * redirects.
 *
 * The owner's answer never depends on the database (see livePackages),
 * so their render does not wait on it at all; a reseller's reads just
 * the reseller records.
 */
export async function withLivePackages(user: SessionUser): Promise<SessionUser> {
  if (user.role === "OWNER") return { ...user, packages: PACKAGE_NAMES };
  const db = await readSlice(["cheatExeUsers"]);
  return { ...user, packages: livePackages(db, user) };
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
