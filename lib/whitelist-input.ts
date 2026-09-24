import { HttpError } from "./auth";
import {
  DEFAULT_WHITELIST_DAYS,
  DEFAULT_WHITELIST_REGION,
  MAX_WHITELIST_DAYS,
  isWhitelistDays,
  isWhitelistRegion,
} from "./packages";

/**
 * Validation shared by the whitelist routes.
 *
 * Here rather than in either route because both spend money on what they
 * let through: `/api/uid-bypass` sells the validity, `/api/uid-bypass/lookup`
 * buys a name. Two copies of these rules would eventually disagree, and the
 * cost of disagreeing is a credit.
 */

/** Upstream's own rule, enforced here so a bad UID never costs a credit. */
const UID_PATTERN = /^\d{6,}$/;

export function cleanUid(value: unknown): string {
  const uid = String(value ?? "").trim();
  if (!UID_PATTERN.test(uid)) throw new HttpError(400, "UID must be at least 6 digits.");
  return uid;
}

/** 1 to the cap, or 0 for lifetime -- the provider's own spelling of it. */
export function cleanDays(value: unknown): number {
  // Only a number, or digits, gets as far as `Number()`. It reads "",
  // " " and false as 0, and 0 is lifetime -- the dearest thing sold.
  const raw = value ?? DEFAULT_WHITELIST_DAYS;
  const days =
    typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim()))
      ? Number(raw)
      : NaN;
  if (!isWhitelistDays(days)) {
    throw new HttpError(
      400,
      `Validity must be a whole number of days from 1 to ${MAX_WHITELIST_DAYS}, or 0 for lifetime.`,
    );
  }
  return days;
}

/**
 * Checked against the known list rather than passed through.
 *
 * The provider bills the add whether or not it recognised the region, so
 * a typo that reaches it is a spent credit on an entry pointed at the
 * wrong servers. Refusing it here costs nothing.
 */
export function cleanRegion(value: unknown): string {
  const region = String(value ?? "").trim().toUpperCase() || DEFAULT_WHITELIST_REGION;
  if (!isWhitelistRegion(region)) throw new HttpError(400, `Unknown server region "${region}".`);
  return region;
}

/** The operator's own label. The player's name comes back from the game. */
export function cleanNote(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 40);
}
