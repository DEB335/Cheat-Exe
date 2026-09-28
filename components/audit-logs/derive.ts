import type { NeonStatus } from "@/components/neon";
import { parseStamp } from "@/lib/trends";
import type { AuditLog } from "@/lib/types";

/**
 * A log record only carries { timestamp, user, action, ip }. Everything
 * the table shows beyond those four -- the status pill, the role chip,
 * the details column -- is read out of them here, by the rules below,
 * and never guessed: a line no rule recognises gets the neutral answer
 * ("Info", no role, "–") rather than a made-up one.
 */

export type AuditStatus = "success" | "warning" | "info" | "failed";
export type AuditRole = "OWNER" | "RESELLER";

/** What the key generator writes: "Generated 3 key(s) for UID BYPASS". */
const GENERATED = /^(Generated \d+ key\(s\) for )(.+)$/;

/**
 * First match wins, in this order:
 *  - info:    the action gave something back or lifted a limit -- an
 *             unban, a lifted block, a removed expiry or key limit.
 *             Checked first, or the words "block" and "removed" in them
 *             would paint a restoration as a warning.
 *  - failed:  the action says it did not happen (failed, denied, invalid,
 *             error, refused, rejected, "could not").
 *  - warning: the action took something away or ended something -- an
 *             expiry, kick, ban, block, delete, removal, clear or
 *             suspension. Checked before success so "Successfully
 *             executed delete_key" reads as the deletion it was.
 *  - success: a sign-in or sign-out, or any line that says "success"
 *             (which is how "executed unban_key" and "reset_hwid" end up).
 *  - info:    everything else -- keys generated, accounts created,
 *             settings updated, UIDs whitelisted, announcements sent.
 */
const STATUS_RULES: ReadonlyArray<[AuditStatus, RegExp]> = [
  ["info", /^(unbanned|lifted block)\b|^removed .+ (expiry|key limit)$/i],
  ["failed", /\b(fail(ed|ure)?|denied|invalid|errors?|refused|rejected|could not)\b/i],
  ["warning", /\b(expired|kicked|ban(ned|_key)?|block(ed)?|delete(d|_key)?|removed|cleared|suspended)\b/i],
  ["success", /\blogged (in|out)\b|\bsuccess(ful(ly)?)?\b/i],
];

/**
 * The rules only read the writer's own words. After a ":" come names,
 * keys and announcement text, and "(…)" holds a UID's name, a device or
 * an IP -- all typed by someone, and an announcement that says "fixed
 * the login error" must not become a Failed row. A generation line ends
 * in the package name, which the owner chose, so it is settled first.
 */
export function auditStatus(action: string): AuditStatus {
  if (GENERATED.test(action)) return "info";
  const head = action.replace(/\([^)]*\)/g, "").split(":")[0].trim();
  for (const [status, rule] of STATUS_RULES) if (rule.test(head)) return status;
  return "info";
}

export const STATUS_LOOK: Record<AuditStatus, { pill: NeonStatus; label: string }> = {
  success: { pill: "success", label: "Success" },
  warning: { pill: "warning", label: "Warning" },
  info: { pill: "info", label: "Info" },
  failed: { pill: "danger", label: "Failed" },
};

/**
 * Every writer stamps the user through displayUser(): "Owner (OWNER)"
 * or "ALPHA (RESELLER)". The suffix becomes the chip; a record without
 * one (written before the suffix existed) keeps its name and no chip.
 */
export function splitUser(user: string): { name: string; role: AuditRole | null } {
  const match = /^(.*?)\s*\((OWNER|RESELLER)\)\s*$/.exec(user);
  if (!match || !match[1]) return { name: user, role: null };
  return { name: match[1], role: match[2] as AuditRole };
}

/** What keys/manage writes: "Successfully executed delete_key on key: …". */
const KEY_ACTION_LABELS: Record<string, string> = {
  reset_hwid: "Reset HWID",
  ban_key: "Ban Key",
  unban_key: "Unban Key",
  delete_key: "Delete Key",
};

const KEY_ACTION = /\bexecuted (\w+) on key\b/;

/**
 * The details column: the package of a key generation, or the key
 * action a manage call ran. Nothing else in a log line is structured
 * enough to lift out, so every other row shows "–".
 */
export function auditDetails(action: string): { text: string; pkg: boolean } | null {
  const generated = GENERATED.exec(action);
  if (generated) return { text: generated[2], pkg: true };
  const keyAction = KEY_ACTION.exec(action)?.[1];
  if (keyAction && KEY_ACTION_LABELS[keyAction]) return { text: KEY_ACTION_LABELS[keyAction], pkg: false };
  return null;
}

/** Splits a generation line so the package name can be lit on its own. */
export function splitGenerated(action: string): { lead: string; pkg: string } | null {
  const match = GENERATED.exec(action);
  return match ? { lead: match[1], pkg: match[2] } : null;
}

export interface AuditStats {
  total: number;
  success: number;
  failed: number;
  /** null until the client clock is known (see useMinute). */
  lastDay: number | null;
}

const DAY = 86_400_000;

export function auditStats(logs: AuditLog[], now: number | null): AuditStats {
  let success = 0;
  let failed = 0;
  let lastDay = 0;
  for (const log of logs) {
    const status = auditStatus(log.action);
    if (status === "success") success += 1;
    else if (status === "failed") failed += 1;
    // Since 24 hours before the current minute, with no upper bound:
    // `now` is rounded down, so this minute's events sit just past it,
    // and no log is written in the future.
    if (now !== null) {
      const at = parseStamp(log.timestamp);
      if (Number.isFinite(at) && at > now - DAY) lastDay += 1;
    }
  }
  return { total: logs.length, success, failed, lastDay: now === null ? null : lastDay };
}

/** "90.1%" of the total, or nothing at all when there is no total to be a share of. */
export function shareOf(part: number, total: number): string | undefined {
  if (total === 0) return undefined;
  const pct = (part / total) * 100;
  return `${pct === 100 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}
