import "server-only";

import { HttpError } from "./auth";

const API_URL = process.env.LICENSE_API_URL;
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
  if (!API_URL || !API_KEY || !APP_ID) {
    throw new HttpError(
      500,
      "License API is not configured. Set LICENSE_API_URL, LICENSE_API_KEY and LICENSE_APP_ID.",
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

export const getStats = () => callLicenseApi<StatsResponse>("reseller_stats");

export const getKeyInfo = (key: string) => callLicenseApi<KeyInfoResponse>("key_info", { key });
