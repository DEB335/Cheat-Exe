import type { Reseller, ResellerStatus } from "./types";

/**
 * Validity and quota for reseller accounts.
 *
 * The upstream license API ignores every duration parameter, so an
 * issued *key* cannot be made to expire from here. A reseller *account*
 * is different: this panel owns it entirely, so validity is enforceable,
 * and it is enforced by computing it rather than by a sweep -- an
 * overdue account is refused on its next request whether or not any
 * background job has run.
 *
 * Shared by both sides on purpose: the server decides access with it and
 * the reseller table renders the same verdict, so the badge can never
 * disagree with what the login does.
 */

export function isExpired(user: Pick<Reseller, "expiresAt">): boolean {
  if (!user.expiresAt) return false;
  const at = Date.parse(user.expiresAt);
  return Number.isFinite(at) && at <= Date.now();
}

/**
 * The status that actually applies right now.
 *
 * A stored status of ACTIVE on an account whose validity ran out is a
 * lie the table used to tell; expiry wins over it.
 */
export function effectiveStatus(user: Pick<Reseller, "status" | "expiresAt">): ResellerStatus {
  if (user.status === "SUSPENDED" || user.status === "PENDING APPROVAL") return user.status;
  return isExpired(user) ? "EXPIRED" : user.status;
}

/** Days left, negative once overdue, or null when the account never expires. */
export function daysLeft(user: Pick<Reseller, "expiresAt">): number | null {
  if (!user.expiresAt) return null;
  const at = Date.parse(user.expiresAt);
  if (!Number.isFinite(at)) return null;
  return Math.ceil((at - Date.now()) / 86_400_000);
}

/** Keys this account may still generate, or null when uncapped. */
export function keysRemaining(
  user: Pick<Reseller, "keyLimit">,
  used: number,
): number | null {
  if (typeof user.keyLimit !== "number" || user.keyLimit <= 0) return null;
  return Math.max(0, user.keyLimit - used);
}

/**
 * Keys reserved by a generate request that has not finished, but only
 * while the reservation is fresh.
 *
 * The upstream mint is capped at 20s, so a reservation older than 60s
 * belongs to a request that died. Ignoring it stops a crash from
 * permanently eating into a reseller's allowance.
 */
const RESERVATION_TTL_MS = 60_000;

export function pendingCount(
  user: Pick<Reseller, "pendingKeys" | "pendingSince">,
  now: number,
): number {
  const pending = user.pendingKeys ?? 0;
  if (pending <= 0 || !user.pendingSince) return 0;
  const since = Date.parse(user.pendingSince);
  if (!Number.isFinite(since) || now - since > RESERVATION_TTL_MS) return 0;
  return pending;
}

/** An ISO date `days` from now, or undefined for an account with no end date. */
export function expiryFromDays(days: number | undefined): string | undefined {
  if (!days || days <= 0) return undefined;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** "12/09/2026" from the stored ISO date, for the reseller table. */
export function formatExpiry(user: Pick<Reseller, "expiresAt">): string {
  if (!user.expiresAt) return "Never";
  const at = new Date(user.expiresAt);
  return Number.isFinite(at.getTime())
    ? at.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Never";
}
