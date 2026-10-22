import "server-only";

import { matchBan, type DeviceMarks } from "./bans";
import { findReseller, statusBlock, verifyPassword } from "./db";
import { effectiveStatus } from "./reseller";
import { lockedToAnotherDevice } from "./device-lock";
import { PACKAGE_NAMES } from "./packages";
import type { BanRule, Database, Role } from "./types";

export type LoginReason =
  | "invalid"
  | "banned"
  | "suspended"
  | "pending"
  | "expired"
  | "device"
  | "locked";

export type LoginOutcome =
  | { ok: true; username: string; role: Role; packages: string[] }
  | { ok: false; reason: LoginReason; rule?: BanRule };

/**
 * Everything resolveLogin reads, and nothing more -- so a caller can hand
 * it a small slice of the state instead of the whole document, whose key
 * history and audit log a sign-in never looks at.
 */
export const LOGIN_FIELDS = [
  "adminUser",
  "cheatExeUsers",
  "cheatExeBannedUsers",
  "cheatExeBans",
] as const;

export type LoginState = Pick<Database, (typeof LOGIN_FIELDS)[number] | "adminPassHash">;

/**
 * Compares the typed password with a stored hash. `account` is the
 * canonical name the hash belongs to -- the owner's stored name or the
 * reseller's record key -- for a checker that can vouch for a pair
 * without running bcrypt (see lib/login-ticket.ts).
 */
export type PasswordCheck = (hash: string, account: string) => Promise<boolean>;

/**
 * A PasswordCheck that runs each distinct hash at most once.
 *
 * The login route resolves twice -- once against an unlocked read, so
 * bcrypt never runs while the row is locked, and again under the lock,
 * where the answer is authoritative. The second pass reuses the first
 * one's answer when the hash is the same string; a hash that changed in
 * between (the password was reset mid-request) is a different key, so
 * it is checked afresh rather than trusted.
 *
 * `vouch` lets a cheaper proof stand in for bcrypt; anything it does not
 * vouch for goes to bcrypt as usual.
 */
export function memoizedCheck(
  password: string,
  vouch?: (hash: string, account: string) => boolean,
): PasswordCheck {
  const answers = new Map<string, Promise<boolean>>();
  return (hash, account) => {
    const key = `${account}\u0000${hash}`;
    let answer = answers.get(key);
    if (!answer) {
      answer = vouch?.(hash, account) ? Promise.resolve(true) : verifyPassword(password, hash);
      answers.set(key, answer);
    }
    return answer;
  };
}

/**
 * Whether `username` names the owner account: the stored owner name, or
 * -- on the file store, with no database configured -- either of the
 * owner names the panel has shipped with. Shared with the login route,
 * which reads the owner's hash under its lock only for an owner sign-in.
 */
export function isOwnerLogin(adminUser: string, username: string): boolean {
  const name = username.trim().toLowerCase();
  return (
    name === adminUser.toLowerCase() ||
    (!process.env.DATABASE_URL && (name === "cheatexe" || name === "jack"))
  );
}

/**
 * Decides whether a username/password pair may sign in, without touching
 * the session or the device list. Both the real login and the live
 * check behind the sign-in button run through here so they can never
 * disagree about what "valid" means.
 *
 * Order matters: the password is verified *before* the account state is
 * revealed, so a stranger guessing usernames only ever learns "invalid".
 * Only someone holding the correct password is told that the account is
 * suspended or banned.
 */
export async function resolveLogin(
  db: LoginState,
  username: string,
  password: string,
  marks: DeviceMarks,
  check: PasswordCheck = (hash) => verifyPassword(password, hash),
): Promise<LoginOutcome> {
  const user = username.trim();
  if (!user || !password) return { ok: false, reason: "invalid" };

  if (isOwnerLogin(db.adminUser, user)) {
    if (!(await check(db.adminPassHash, db.adminUser))) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, username: db.adminUser, role: "OWNER", packages: PACKAGE_NAMES };
  }

  const rule = matchBan(db, marks);
  if (rule) return { ok: false, reason: "device", rule };

  const match = findReseller(db, user);
  // Same answer for an unknown user and a wrong password -- the response
  // must not reveal which usernames exist.
  if (!match || !(await check(match.user.pass, match.key))) {
    return { ok: false, reason: "invalid" };
  }

  const banned = db.cheatExeBannedUsers.some(
    (b) => b.username.toLowerCase() === match.key.toLowerCase(),
  );
  if (banned) return { ok: false, reason: "banned" };

  const blocked = statusBlock(effectiveStatus(match.user));
  if (blocked) return { ok: false, reason: blocked };

  // Right password, right account, wrong machine: the login has been
  // handed to someone else.
  if (lockedToAnotherDevice(db, match.key, marks)) {
    return { ok: false, reason: "locked" };
  }

  return {
    ok: true,
    username: match.key,
    role: "RESELLER",
    packages: match.user.packages ?? [],
  };
}

/** Wire codes the login page switches its full-screen panels on. */
export const LOGIN_ERROR: Record<Exclude<LoginReason, "invalid">, string> = {
  banned: "BANNED",
  suspended: "SUSPENDED",
  pending: "PENDING",
  expired: "EXPIRED",
  device: "DEVICE_BANNED",
  locked: "DEVICE_LOCKED",
};
