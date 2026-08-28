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
 * There are two numbers in play and only one of them is true. The
 * generator's "validity (days)" box is a request, and the upstream API
 * discards it -- verified against the live API with fifteen different
 * parameter spellings in one call, every one ignored, every key issued
 * as lifetime. `expiry` is what the API said it actually did, read back
 * after minting, so it is the only one that can be stated as fact.
 *
 * When there is no `expiry` to go on, this says so. Falling back to the
 * requested number is exactly the bug this replaces: a key generated for
 * ten days was listed as "10 Days" while the provider had issued it as
 * lifetime.
 */
export function keyValidity(record: Pick<KeyRecord, "duration" | "expiry">): {
  label: string;
  certain: boolean;
} {
  if (!record.expiry) return { label: `${record.duration}d requested`, certain: false };
  // The API spells lifetime "Never (Lifetime)", which reads oddly in a
  // column headed Validity.
  if (/lifetime|never/i.test(record.expiry)) return { label: "Lifetime", certain: true };
  return { label: record.expiry, certain: true };
}
