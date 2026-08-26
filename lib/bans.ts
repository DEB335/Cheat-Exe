import "server-only";

import type { BanRule, BanScope, Database } from "./types";

export interface DeviceMarks {
  ip: string;
  hwid?: string;
  fingerprint?: string;
}

/** The rule that blocks this request, or null when nothing matches. */
export function matchBan(db: Database, marks: DeviceMarks): BanRule | null {
  for (const rule of db.cheatExeBans) {
    const against = marks[rule.scope];
    if (against && against.toLowerCase() === rule.value.toLowerCase()) return rule;
  }
  return null;
}

export function hasBan(db: Database, scope: BanScope, value: string): boolean {
  return db.cheatExeBans.some(
    (rule) => rule.scope === scope && rule.value.toLowerCase() === value.toLowerCase(),
  );
}

/** Adds a rule unless an identical one is already present. */
export function addBan(db: Database, rule: BanRule): boolean {
  if (!rule.value || hasBan(db, rule.scope, rule.value)) return false;
  db.cheatExeBans.unshift(rule);
  if (db.cheatExeBans.length > 500) db.cheatExeBans.pop();
  return true;
}

export function removeBan(db: Database, scope: BanScope, value: string): boolean {
  const before = db.cheatExeBans.length;
  db.cheatExeBans = db.cheatExeBans.filter(
    (rule) => !(rule.scope === scope && rule.value.toLowerCase() === value.toLowerCase()),
  );
  return db.cheatExeBans.length < before;
}

/**
 * Ends every live session that the given rules now block, so a ban takes
 * effect on the target's next poll instead of at token expiry.
 */
export function dropBannedSessions(db: Database, keepSessionId?: string): void {
  db.cheatExeDevices = db.cheatExeDevices.filter((device) => {
    if (device.sessionId === keepSessionId) return true;
    return !matchBan(db, {
      ip: device.ip,
      hwid: device.hwid,
      fingerprint: device.fingerprint,
    });
  });
}

export const BAN_SCOPE_LABEL: Record<BanScope, string> = {
  ip: "IP address",
  hwid: "Device ID",
  fingerprint: "Device signature",
};
