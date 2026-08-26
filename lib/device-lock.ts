import "server-only";

import type { DeviceMarks } from "./bans";
import { findReseller } from "./db";
import type { Database, DeviceLock, Reseller } from "./types";

/**
 * Pins a reseller account to one machine so the login cannot be passed
 * around.
 *
 * This is a different thing from the license-key HWID the upstream API
 * binds: that stops a *customer* sharing a key, this stops a *reseller*
 * sharing their dashboard account. It is also a different thing from a
 * device ban, which blocks a machine outright regardless of account.
 *
 * The bind happens on the first sign-in after locking, because the owner
 * cannot know the machine in advance. Reset clears it and the next
 * sign-in claims the account again.
 */

/** True when the account is locked and this is not the machine it is bound to. */
export function lockedToAnotherDevice(
  db: Database,
  username: string,
  marks: DeviceMarks,
): boolean {
  const match = findReseller(db, username);
  if (!match) return false;
  return isMismatch(match.user, marks);
}

function isMismatch(user: Reseller, marks: DeviceMarks): boolean {
  if (!user.deviceLocked) return false;

  const lock = user.lock;
  // Locked but not yet claimed -- the next sign-in binds it.
  if (!lock?.hwid && !lock?.fingerprint) return false;

  // The cookie id is the only thing precise enough to *be* an identity.
  //
  // The fingerprint deliberately does NOT widen the match here, unlike in
  // a device ban where over-matching is the point. It is a hash of the
  // user-agent trio, so every Chrome-on-Windows browser produces the same
  // one -- accepting it would let anyone on a similar machine walk into a
  // locked account, which is the whole thing this is meant to stop.
  //
  // The cost is that clearing cookies mints a new id and locks the real
  // owner out. That is the correct trade for an anti-sharing lock, and it
  // is one click for the owner to Reset HWID.
  if (lock.hwid) return !marks.hwid || lock.hwid !== marks.hwid;

  // No cookie id was ever recorded; fall back to the coarse mark.
  return !marks.fingerprint || lock.fingerprint !== marks.fingerprint;
}

/** Claims an unbound lock for this device. No-op if the account is already bound. */
export function bindDevice(user: Reseller, marks: DeviceMarks, at: string): boolean {
  if (!user.deviceLocked) return false;
  if (user.lock?.hwid || user.lock?.fingerprint) return false;

  const lock: DeviceLock = {
    hwid: marks.hwid,
    fingerprint: marks.fingerprint,
    ip: marks.ip,
    boundAt: at,
  };
  user.lock = lock;
  return true;
}

/** Drops the binding so the next sign-in re-claims the account. */
export function clearLock(user: Reseller): void {
  delete user.lock;
}
