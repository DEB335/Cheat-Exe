import "server-only";

import { HttpError } from "./auth";
import { PACKAGE_NAMES } from "./packages";

/**
 * The provider's admin endpoint, moved off `auth.terminalx999.online`.
 *
 * That host now answers 404, so a deployment still configured with it
 * gets the new one rather than a panel where every call fails. Any
 * other value set in the environment wins.
 */
export const DEFAULT_API_URL = "https://prtvshow.online/api_admin.php";
const RETIRED_API_HOST = "auth.terminalx999.online";

export function resolveApiUrl(configured: string | undefined): string {
  const url = configured?.trim();
  return !url || url.includes(RETIRED_API_HOST) ? DEFAULT_API_URL : url;
}

const API_URL = resolveApiUrl(process.env.LICENSE_API_URL);
const API_KEY = process.env.LICENSE_API_KEY;
const APP_ID = process.env.LICENSE_APP_ID;

/**
 * Every response from api_admin.php shares this envelope. `signature` is
 * a sha256 the upstream attaches; we pass it through but cannot verify
 * it without the signing scheme from the provider.
 */
export interface LicenseEnvelope {
  success?: boolean;
  message?: string;
  timestamp?: number;
  signature?: string;
}

export interface PackagesResponse extends LicenseEnvelope {
  packages?: Array<{
    app_id: string;
    app_name: string;
    package_id: string;
    package_name: string;
    display_name: string;
  }>;
  linked_admin?: string;
}

export interface StatsResponse extends LicenseEnvelope {
  username?: string;
  total_keys?: number;
  active_keys?: number;
  banned_keys?: number;
  used_keys?: number;
  key_limit?: number;
  keys_created?: number;
  remaining?: number;
}

export interface KeyInfoResponse extends LicenseEnvelope {
  key?: string;
  app_name?: string;
  package_name?: string;
  status?: string;
  created_at?: string;
  expiry_date?: string;
  hwid?: string;
  ip?: string;
  duration_days?: number;
}

export interface GenerateResponse extends LicenseEnvelope {
  app_name?: string;
  package_name?: string;
  count?: number;
  keys?: string[];
  /** Where the relocated endpoint nests them, per the provider's own client. */
  data?: { keys?: string[]; key?: string };
  /** Older shape: a single key rather than an array. */
  key?: string;
}

/**
 * Single entry point to the upstream license API. The credentials live
 * in env vars and are attached here, so they never reach the browser.
 */
export async function callLicenseApi<T extends LicenseEnvelope>(
  action: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!API_KEY || !APP_ID) {
    throw new HttpError(
      500,
      "License API is not configured. Set LICENSE_API_KEY and LICENSE_APP_ID.",
    );
  }

  const form = new URLSearchParams({ api_key: API_KEY, app_id: APP_ID, action, ...params });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    return (await response.json()) as T;
  } catch (err) {
    throw new HttpError(502, `License API unreachable: ${(err as Error).message}`);
  }
}

export const getPackages = () => callLicenseApi<PackagesResponse>("get_admin_packages");

/**
 * Resolves a package id the bundled list does not know about.
 *
 * The generator renders whatever the API reports, so a package added
 * upstream appears immediately -- but generation used to validate only
 * against the hardcoded list and answer "Unknown package." for it. This
 * asks the API instead, so the two can drift without breaking.
 */
export async function livePackage(
  packageId: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const data = await getPackages();
    const match = data.packages?.find((p) => p.package_id === packageId);
    return match ? { id: match.package_id, name: match.package_name } : null;
  } catch {
    return null;
  }
}

export const getStats = () => callLicenseApi<StatsResponse>("reseller_stats");

export const getKeyInfo = (key: string) => callLicenseApi<KeyInfoResponse>("key_info", { key });

/**
 * The package names a reseller grant is allowed to contain.
 *
 * The live list, because the generator sells from the live list. A
 * package the provider offers but this check refuses is one that can
 * be sold and not granted -- which is precisely how FPS BOOSTER came
 * to be generatable and ungrantable at once, the grant routes having
 * filtered against the compiled-in names while the generator read the
 * API.
 *
 * Falls back to the bundled names when the provider is unreachable, so
 * an outage narrows what can be granted rather than silently emptying
 * every grant that passes through it.
 */
export async function grantablePackageNames(): Promise<string[]> {
  try {
    const data = await getPackages();
    const names = (data.packages ?? [])
      .map((p) => p.package_name)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names;
  } catch {
    /* fall through to the bundled list */
  }
  return PACKAGE_NAMES;
}
