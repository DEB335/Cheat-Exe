import "server-only";

import { HttpError } from "./auth";
import { resolveApiUrl } from "./license-api";

export const DEFAULT_API_URL = "https://prtvshow.online/api_admin.php";
export const DEFAULT_API_KEY = "TX999_65f7e1c2128683875c69c197a929c377a78a18c59fcc80351fba5e7d15743896";

const API_URL = resolveApiUrl(process.env.LIB_BYPASS_API_URL || process.env.LICENSE_API_URL || DEFAULT_API_URL);
const API_KEY = process.env.LIB_BYPASS_API_KEY ?? process.env.TX999_API_KEY ?? process.env.LICENSE_API_KEY ?? DEFAULT_API_KEY;

export interface LibBypassEnvelope {
  success?: boolean;
  message?: string;
  timestamp?: number;
  signature?: string;
  maintenance?: boolean;
  target?: string;
  recommended_version?: string;
}

export interface GenerateLibKeyResponse extends LibBypassEnvelope {
  count?: number;
  keys?: string[];
  duration_days?: number;
  expires_at?: number;
  lib_version?: string;
}

export interface LibKeyInfoResponse extends LibBypassEnvelope {
  key?: string;
  lib_version?: string;
  status?: string;
  is_expired?: boolean;
  duration_days?: number;
  expires_at?: number;
  expires_at_date?: string;
  has_hwid?: boolean;
  hwid_locked?: boolean;
  created_at?: number;
  created_at_date?: string;
  made_by_username?: string;
  note?: string;
}

/**
 * Executes a POST request to the Lib Bypass API endpoint.
 */
export async function callLibBypassApi<T extends LibBypassEnvelope>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const payload = {
    api_key: API_KEY,
    action,
    ...params,
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    const raw = await response.text();
    let data: T;
    try {
      data = JSON.parse(raw) as T;
    } catch {
      throw new HttpError(
        response.status >= 500 ? 502 : response.status,
        `Lib Bypass Upstream (${response.status}): ${raw || "Empty response from provider"}`,
      );
    }

    return data;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, `Lib Bypass API unreachable: ${(err as Error).message}`);
  }
}

/**
 * Generates one or more Lib Bypass keys via upstream provider.
 * Supports Engine V1 (Discord Bot) and V2 (Sensix Cloud).
 */
export async function generateLibKey(options: {
  engine: "V1" | "V2";
  days: number;
  count?: number;
  customKey?: string;
  note?: string;
}): Promise<GenerateLibKeyResponse> {
  const libVersion = options.engine === "V1" ? "v1" : "v2";

  // Note: Upstream Sensix Cloud V2 requires a key/username name string.
  // If not provided by user, generate a clean standardized key format.
  let keyToSend = options.customKey?.trim();
  if (!keyToSend) {
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    keyToSend = `EMU-${rand.slice(0, 4)}-${rand.slice(4, 8)}`;
  }

  const res = await callLibBypassApi<GenerateLibKeyResponse>("generate_lib_key", {
    lib_version: libVersion,
    days: options.days,
    count: options.count ?? 1,
    custom_key: keyToSend,
    note: options.note ?? `Lib Bypass Client [${options.engine}]`,
  });

  if (!res.success) {
    throw new HttpError(
      res.maintenance ? 503 : 400,
      res.message || `Failed to generate ${options.engine} Lib Bypass key.`,
    );
  }

  return res;
}

/**
 * Resets HWID for a Lib Bypass key upstream.
 */
export async function resetLibHwid(key: string, engine: "V1" | "V2" = "V2"): Promise<LibBypassEnvelope> {
  const res = await callLibBypassApi<LibBypassEnvelope>("reset_lib_hwid", {
    lib_version: engine.toLowerCase(),
    key: key.trim(),
  });

  if (!res.success) {
    throw new HttpError(400, res.message || `Failed to reset HWID for key ${key}.`);
  }

  return res;
}

/**
 * Deletes a Lib Bypass key upstream.
 */
export async function deleteLibKey(key: string, engine: "V1" | "V2" = "V2"): Promise<LibBypassEnvelope> {
  const res = await callLibBypassApi<LibBypassEnvelope>("delete_lib_key", {
    lib_version: engine.toLowerCase(),
    key: key.trim(),
  });

  if (!res.success) {
    throw new HttpError(400, res.message || `Failed to delete key ${key}.`);
  }

  return res;
}

/**
 * Fetches detailed info for a Lib Bypass key from the provider.
 */
export async function getLibKeyInfo(key: string, engine: "V1" | "V2" = "V2"): Promise<LibKeyInfoResponse> {
  const res = await callLibBypassApi<LibKeyInfoResponse>("lib_key_info", {
    lib_version: engine.toLowerCase(),
    key: key.trim(),
  });

  return res;
}
