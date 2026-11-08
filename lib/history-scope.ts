import type { KeyRecord, Role } from "./types";
import { isCreatorMatch } from "./utils";

/**
 * Who a "Clear" removes, shared by the API route and the client mirror.
 *
 * The same list holds owner keys, reseller keys and Emulator Bypass keys.
 * A clear names a scope -- the owner's own keys, or the resellers' -- and
 * the two sides must agree on it exactly, or the row the client paints
 * disappears and comes back when the refetch lands.
 */

/** Package name the bypass engine owns; never cleared from here. */
export const EMULATOR_PACKAGE = "EMULATOR BYPASS";

export type HistoryScope = "owner" | "reseller";

export interface HistoryActor {
  role: Role;
  username: string;
}

/** Rows the owner created ("admin", "Owner", "Owner (OWNER)"). */
export function isOwnerCreator(creator: string | undefined | null): boolean {
  const c = (creator ?? "").trim().toLowerCase();
  return c === "admin" || c === "owner" || c.startsWith("owner (") || c.startsWith("owner ");
}

/**
 * Whether a clear of `scope` by `actor` removes this row.
 *
 *  - owner    -- the owner's own keys (owner only).
 *  - reseller -- every reseller's keys when the owner asks; a reseller
 *                clearing their own list only loses their own rows.
 *
 * Emulator Bypass keys are never in scope: the bypass tables delete them
 * one by one against their own engine, so a history clear must not take
 * them with it.
 */
export function inClearScope(
  record: Pick<KeyRecord, "creator" | "package">,
  scope: HistoryScope,
  actor: HistoryActor,
): boolean {
  if (record.package === EMULATOR_PACKAGE) return false;
  if (scope === "owner") return isOwnerCreator(record.creator);
  if (actor.role === "OWNER") return !isOwnerCreator(record.creator);
  return isCreatorMatch(record.creator, actor.username);
}

/** The audit line a clear of this scope writes. */
export function clearAuditAction(scope: HistoryScope, actor: HistoryActor): string {
  if (scope === "owner") return "Cleared Owner key history";
  if (actor.role !== "OWNER") return "Cleared own key history";
  return "Cleared Reseller key history";
}
