import type { LicensePackage } from "./types";

/**
 * Package ids as accepted by the upstream license API. These are not
 * secrets -- they are opaque handles the API maps to a product.
 */
export const PACKAGES: LicensePackage[] = [
  { id: "e52c1515c53453b85d0d4e87", name: "BASIC PANEL", description: "Basic Package" },
  { id: "affc8da8fd5ace99981ab877", name: "AIMSILENT EXE", description: "Aimsilent Package" },
  { id: "cb921031dc43197e8ccb6828", name: "UID BYPASS", description: "UID Bypass Package" },
  { id: "3d1c6c948b4715fbd2fada2d", name: "EXTERNAL PANEL", description: "External Package" },
  { id: "d4f0ce93349f236711344cb5", name: "PVT AIMKILL", description: "Private Aimkill" },
  { id: "154d1edaddd7203fbfd847f4", name: "VAULT PANEL", description: "Vault Package" },
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
};

export function shortPackageLabel(name: string): string {
  return SHORT_LABELS[name] ?? name;
}

export function packageById(id: string): LicensePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}
