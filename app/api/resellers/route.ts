import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, hashPassword, updateDb } from "@/lib/db";
import { PACKAGE_NAMES } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import { expiryFromDays } from "@/lib/reseller";
import { formatDateOnly } from "@/lib/utils";

interface CreateBody {
  username?: string;
  password?: string;
  packages?: string[];
  /** 0 or absent means the account never expires. */
  validityDays?: number;
  /** 0 or absent means no cap on key generation. */
  keyLimit?: number;
  /** Pin the account to the first machine it signs in from. */
  deviceLocked?: boolean;
}

export const POST = route(async (request: Request) => {
  await requireOwner();
  const body = await readJson<CreateBody>(request);

  const username = (body.username ?? "").trim();
  const password = (body.password ?? "").trim();

  if (!username || !password) throw new HttpError(400, "Enter username and password!");
  if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters.");

  const packages = (body.packages ?? []).filter((p) => PACKAGE_NAMES.includes(p));

  const validityDays = numeric(body.validityDays, "Validity");
  const keyLimit = numeric(body.keyLimit, "Key limit");

  const hash = await hashPassword(password);
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    if (findReseller(db, username)) throw new HttpError(409, "User already exists!");
    db.cheatExeUsers[username] = {
      pass: hash,
      status: "PENDING APPROVAL",
      created: formatDateOnly(),
      packages,
      expiresAt: expiryFromDays(validityDays),
      keyLimit: keyLimit || undefined,
      deviceLocked: body.deviceLocked !== false,
    };
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: `Created reseller account: ${username}`,
      ip,
    });

    // Reaching here always means a new account was written -- the
    // duplicate-name case threw above -- so this always has something to
    // announce.
    await ping("reseller", tx);
  });

  return NextResponse.json({ success: true });
});

/** Optional whole number >= 0. Anything else is a mistake worth reporting. */
function numeric(value: unknown, field: string): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new HttpError(400, `${field} must be a whole number of 0 or more.`);
  }
  return n;
}
