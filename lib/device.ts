import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";

/**
 * A browser has no hardware id, so "HWID" here means two things read
 * together:
 *
 *  - `hwid`         an opaque random id kept in a year-long httpOnly
 *                   cookie. Stable across logins and account switches,
 *                   and the value a device ban is written against.
 *  - `fingerprint`  a hash of the user-agent trio. Weak on its own --
 *                   two identical laptops collide -- but it survives the
 *                   cookie being cleared, so a device ban stores both
 *                   and matches on either.
 *
 * Neither is spoof-proof. They stop the casual "log in again from the
 * same machine", not a determined attacker; an IP ban is the blunter
 * companion for that.
 */
export const DEVICE_COOKIE = "cheatexe_device";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const deviceCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
} as const;

export interface DeviceIdentity {
  hwid: string;
  fingerprint: string;
  /** True when `hwid` was just minted and still has to be written to a cookie. */
  isNew: boolean;
}

export async function deviceIdentity(): Promise<DeviceIdentity> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  const hwid = existing && /^[a-f0-9]{32}$/.test(existing) ? existing : newHwid();

  return { hwid, fingerprint: await fingerprint(), isNew: hwid !== existing };
}

function newHwid(): string {
  return randomBytes(16).toString("hex");
}

async function fingerprint(): Promise<string> {
  const h = await headers();
  const parts = [
    h.get("user-agent") ?? "",
    h.get("accept-language") ?? "",
    h.get("sec-ch-ua-platform") ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
