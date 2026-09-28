import {
  DEFAULT_WHITELIST_DAYS,
  DEFAULT_WHITELIST_REGION,
  LIFETIME_WHITELIST_DAYS,
  WHITELIST_REGIONS,
  isWhitelistRegion,
} from "@/lib/packages";

/** A type, not an interface: `api<T>` wants an implicit index signature. */
export type AddResult = {
  name?: string;
  expireDate?: string;
};

/**
 * What to tell someone after an add or a re-issue.
 *
 * The provider answers with the player it verified, which is the useful
 * half -- it is the only confirmation that the UID typed belongs to the
 * customer meant. It does not always answer with a date, so the validity
 * asked for stands in rather than a guessed one.
 */
export function addedMessage(result: AddResult, uid: string, days: number): string {
  const who = result.name ? `${result.name} (${uid})` : `UID ${uid}`;
  const until = result.expireDate
    ? `until ${result.expireDate}`
    : days === LIFETIME_WHITELIST_DAYS
      ? "for lifetime"
      : `for ${days} day${days === 1 ? "" : "s"}`;
  return `${who} whitelisted ${until}.`;
}

/** What the days field asks for. Empty is the default, not zero. */
export function wantedDays(days: string): number {
  return days.trim() === "" ? DEFAULT_WHITELIST_DAYS : Number(days);
}

/** Entries predating the move read "ALL SERVER", which is not selectable. */
export function startingRegion(region: string): string {
  return isWhitelistRegion(region) ? region : DEFAULT_WHITELIST_REGION;
}

/** "India" for "IND". Codes the panel does not sell ("ALL SERVER") have no name. */
export function regionName(code: string): string | undefined {
  return WHITELIST_REGIONS.find((region) => region.code === code)?.label;
}
