import type { KeyRecord, LicensePackage, Role } from "./types";

/**
 * Package ids as accepted by the upstream license API. These are not
 * secrets -- they are opaque handles the API maps to a product.
 *
 * This list is a fallback and a permissions vocabulary: the generator
 * shows whatever `get_admin_packages` returns live, and reseller grants
 * are checked against the names here. A package added upstream but not
 * added here can be picked in the UI and then refused on submit, so keep
 * the two in step -- `/api/keys` re-checks against the live list before
 * rejecting anything, which stops that mismatch being fatal.
 */
export const PACKAGES: LicensePackage[] = [
  { id: "e52c1515c53453b85d0d4e87", name: "BASIC PANEL", description: "Basic Package" },
  { id: "affc8da8fd5ace99981ab877", name: "AIMSILENT EXE", description: "Aimsilent Package" },
  { id: "cb921031dc43197e8ccb6828", name: "UID BYPASS", description: "UID Bypass Package" },
  { id: "3d1c6c948b4715fbd2fada2d", name: "EXTERNAL PANEL", description: "External Package" },
  { id: "d4f0ce93349f236711344cb5", name: "PVT AIMKILL", description: "Private Aimkill" },
  { id: "154d1edaddd7203fbfd847f4", name: "VAULT PANEL", description: "Vault Package" },
  { id: "db3b90e8134ec738b94a9b05", name: "LIB BYPASS", description: "LIB Bypass Package" },
];

export const PACKAGE_NAMES = PACKAGES.map((p) => p.name);

/** Short labels used by the glowing badges in the reseller table. */
const SHORT_LABELS: Record<string, string> = {
  "BASIC PANEL": "BASIC",
  "AIMSILENT EXE": "AIMSILENT",
  "UID BYPASS": "UID",
  "EXTERNAL PANEL": "EXTERNAL",
  "PVT AIMKILL": "PVT AIMKILL",
  "VAULT PANEL": "VAULT",
  "LIB BYPASS": "LIB",
};

export function shortPackageLabel(name: string): string {
  return SHORT_LABELS[name] ?? name;
}

/** The package that unlocks the UID Bypass whitelist section. */
export const UID_BYPASS_PACKAGE = "UID BYPASS";

/**
 * Longest validity the upstream whitelist accepts, in days.
 *
 * Lives here rather than in `lib/uid-api` so the form can enforce it
 * before spending a credit -- that module is server-only.
 */
export const MAX_WHITELIST_DAYS = 30;

/**
 * Who may manage the UID whitelist.
 *
 * The owner always may. A reseller needs the UID BYPASS grant, which is
 * the same vocabulary the generator already checks against -- so taking
 * the package away closes the section too, with nothing else to revoke.
 *
 * Both the sidebar and the API route read this, so the tab and the
 * endpoint can never disagree about who is allowed in.
 */
export function canManageWhitelist(
  user: { role: Role; packages: string[] } | null | undefined,
): boolean {
  if (!user) return false;
  return user.role === "OWNER" || user.packages.includes(UID_BYPASS_PACKAGE);
}

export function packageById(id: string): LicensePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

/**
 * How long a key is actually good for, ready to display.
 *
 * The provider honours the validity, but only under the name it
 * documents. This panel sent `duration`; the name is `days`. Keys minted
 * before that was corrected were given the provider's own default, so
 * the number chosen for them describes nothing and is not shown -- that
 * mismatch is the whole reason a key generated for 10 days turned up in
 * the provider's portal as 30.
 *
 * `appliedDays` is set only when the request went out under the name
 * that works, which is what separates a number worth printing from one
 * that was quietly discarded.
 *
 * Their `key_info` is no help either way: it reports every unused key as
 * `duration_days: 0`, `"Never (Lifetime)"`, contradicting their own
 * portal. A genuine date is preferred if one ever appears, which is why
 * it is checked first.
 */
export function keyValidity(record: Pick<KeyRecord, "duration" | "appliedDays" | "expiry">): {
  label: string;
  certain: boolean;
} {
  if (record.expiry && !/lifetime|never/i.test(record.expiry)) {
    return { label: record.expiry, certain: true };
  }
  if (record.appliedDays !== undefined) {
    return { label: daysLabel(record.appliedDays), certain: true };
  }

  // An older key still shows the number it was asked for, marked as
  // unconfirmed. Saying nothing at all was worse: the provider's default
  // matched the request for most of these anyway, and a row reading only
  // "Set by provider" tells the owner nothing about a key they are
  // selling. The styling and the tooltip carry the doubt instead.
  const asked = Number(record.duration);
  if (Number.isFinite(asked) && asked >= 0) return { label: daysLabel(asked), certain: false };

  return { label: "Set by provider", certain: false };
}

function daysLabel(days: number): string {
  return days === 0 ? "Lifetime" : `${days} days`;
}
