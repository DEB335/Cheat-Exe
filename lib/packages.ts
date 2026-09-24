import type { KeyRecord, LicensePackage, Role } from "./types";

/**
 * Package ids as accepted by the upstream license API. These are not
 * secrets -- they are opaque handles the API maps to a product.
 *
 * This list is a fallback, used only until the live list loads or when
 * the provider is unreachable. The generator and the reseller grant
 * toggles both render `store.packages`, which is refreshed from
 * `get_admin_packages` -- so a package added upstream appears in both
 * without a redeploy.
 *
 * It was not always so. The generator read the live list while reseller
 * management read this one, which meant a new package could be sold and
 * not granted: FPS BOOSTER was generatable and ungrantable at the same
 * time. Keeping this list current is still worth doing -- it is what
 * shows while the provider is down -- but nothing should read it in
 * preference to the live one.
 */
export const PACKAGES: LicensePackage[] = [
  { id: "e52c1515c53453b85d0d4e87", name: "BASIC PANEL", description: "Basic Package" },
  { id: "affc8da8fd5ace99981ab877", name: "AIMSILENT EXE", description: "Aimsilent Package" },
  { id: "cb921031dc43197e8ccb6828", name: "UID BYPASS", description: "UID Bypass Package" },
  { id: "3d1c6c948b4715fbd2fada2d", name: "EXTERNAL PANEL", description: "External Package" },
  { id: "d4f0ce93349f236711344cb5", name: "PVT AIMKILL", description: "Private Aimkill" },
  { id: "154d1edaddd7203fbfd847f4", name: "VAULT PANEL", description: "Vault Package" },
  { id: "db3b90e8134ec738b94a9b05", name: "LIB BYPASS", description: "LIB Bypass Package" },
  { id: "2411bc9db9f9a66c6e876ad2", name: "FPS BOOSTER", description: "FPS Booster Package" },
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
  "FPS BOOSTER": "FPS",
};

export function shortPackageLabel(name: string): string {
  return SHORT_LABELS[name] ?? name;
}

/** The package that unlocks the UID Bypass whitelist section. */
export const UID_BYPASS_PACKAGE = "UID BYPASS";

/**
 * Longest validity this panel sells, in days.
 *
 * This panel's cap, not the provider's: the admin API takes longer
 * runs (and 0 for lifetime). Raising it here is a pricing decision, so
 * it is not pinned to whatever the API happens to allow.
 *
 * Lives here rather than in `lib/uid-api` so the form can enforce it
 * before spending a credit -- that module is server-only.
 */
export const MAX_WHITELIST_DAYS = 365;

/** What the provider takes as "never expires". Sold alongside the day counts. */
export const LIFETIME_WHITELIST_DAYS = 0;

/** Sent when no validity is given. The form shows it rather than hiding it. */
export const DEFAULT_WHITELIST_DAYS = 30;

/** The one-tap validities offered under the days field, in order. */
export const WHITELIST_DAY_PRESETS = [1, 3, 7, 30, 60, 90, 180, 365, LIFETIME_WHITELIST_DAYS] as const;

/** Whether `days` is something the panel sells: lifetime, or 1 to the cap. */
export function isWhitelistDays(days: number): boolean {
  return (
    Number.isInteger(days) &&
    (days === LIFETIME_WHITELIST_DAYS || (days >= 1 && days <= MAX_WHITELIST_DAYS))
  );
}

/** "1 Day", "30 Days", "Lifetime". */
export function whitelistDaysLabel(days: number): string {
  if (days === LIFETIME_WHITELIST_DAYS) return "Lifetime";
  return `${days} Day${days === 1 ? "" : "s"}`;
}

/**
 * The server regions the whitelist accepts, in the provider's own order.
 *
 * Region used to be fiction: the retired service ignored it and every
 * entry came back as ALL SERVER. The admin API takes it for real, so it
 * is chosen per UID now -- and a wrong one is a wasted credit, which is
 * why the list is enumerated here rather than typed into a free field.
 *
 * Here rather than in `lib/uid-api` for the same reason as the day cap:
 * the form has to offer these, and that module is server-only.
 */
export const WHITELIST_REGIONS = [
  { code: "IND", label: "India" },
  { code: "BD", label: "Bangladesh" },
  { code: "BR", label: "Brazil" },
  { code: "SG", label: "Singapore" },
  { code: "RU", label: "Russia" },
  { code: "ID", label: "Indonesia" },
  { code: "TW", label: "Taiwan" },
  { code: "US", label: "United States" },
  { code: "VN", label: "Vietnam" },
  { code: "PK", label: "Pakistan" },
] as const;

export type WhitelistRegion = (typeof WHITELIST_REGIONS)[number]["code"];

export const DEFAULT_WHITELIST_REGION: WhitelistRegion = "IND";

export function isWhitelistRegion(value: string): value is WhitelistRegion {
  return WHITELIST_REGIONS.some((region) => region.code === value);
}

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
