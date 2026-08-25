"use client";

interface ApiResult {
  success?: boolean;
  message?: string;
  [k: string]: unknown;
}

/**
 * Thin fetch wrapper that turns a non-2xx response into a thrown Error
 * carrying the server message, so callers can just try/catch and toast.
 */
export async function api<T extends ApiResult = ApiResult>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let payload: T;
  try {
    payload = (await response.json()) as T;
  } catch {
    payload = {} as T;
  }

  if (!response.ok) {
    // A hard navigation on session loss is deliberate: it discards every
    // piece of client state along with the dead session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (response.status === 401) window.location.href = "/login";
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  }

  return payload;
}

export function postJson<T extends ApiResult = ApiResult>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T extends ApiResult = ApiResult>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function del<T extends ApiResult = ApiResult>(path: string) {
  return api<T>(path, { method: "DELETE" });
}
