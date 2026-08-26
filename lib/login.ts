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
  db: Database,
  username: string,
  password: string,
  marks: DeviceMarks,
): Promise<LoginOutcome> {
  const user = username.trim();
  if (!user || !password) return { ok: false, reason: "invalid" };

  const isOwnerName = user.toLowerCase() === db.adminUser.toLowerCase();

  if (isOwnerName) {
    if (!(await verifyPassword(password, db.adminPassHash))) {
      return { ok: false, reason: "invalid" };
    }
    // Device blocks deliberately do not apply to the owner account.
    // Banning an address you later move onto -- a rotated home IP, a
    // phone hotspot -- would otherwise lock the only account that can
    // lift the block, with no way back in short of editing the database.
    // Someone who already holds the owner password is past this anyway.
    return { ok: true, username: db.adminUser, role: "OWNER", packages: PACKAGE_NAMES };
  }

  const rule = matchBan(db, marks);
  if (rule) return { ok: false, reason: "device", rule };

  const match = findReseller(db, user);
  // Same answer for an unknown user and a wrong password -- the response
  // must not reveal which usernames exist.
  if (!match || !(await verifyPassword(password, match.user.pass))) {
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
