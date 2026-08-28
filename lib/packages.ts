import type { KeyRecord, LicensePackage } from "./types";

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

export function packageById(id: string): LicensePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

/**
 * How long a key is actually good for, ready to display.
 *
 * Three sources claim to answer this and no two of them agree, so the
 * honest answer is usually that we do not know:
 *
 *   - the generator's "validity (days)" box is only a request, and the
 *     provider discards it. Two keys minted moments apart with `days`
 *     set to 10 and to 0 came out identical.
 *   - `key_info` answers `duration_days: 0` and `expiry_date: "Never
 *     (Lifetime)"` for those same keys.
 *   - the provider's own portal lists both of them as 30 days.
 *
 * The likeliest reading is that a key has no expiry until it is first
 * used -- the portal says "On First Use" beside the number -- and that
 * their API reports that empty column as lifetime. Whatever the cause,
 * an unused key's reported expiry cannot be repeated as fact, and the
 * requested number never could be.
 *
 * So only a real date is shown. Anything else says who actually decides,
 * which is the one thing here that is definitely true.
 */
export function keyValidity(record: Pick<KeyRecord, "duration" | "expiry">): {
  label: string;
  certain: boolean;
} {
  if (record.expiry && !/lifetime|never/i.test(record.expiry)) {
    return { label: record.expiry, certain: true };
  }
  return { label: "Set by provider", certain: false };
}
