import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, hashPassword, updateDb } from "@/lib/db";
import { clearLock } from "@/lib/device-lock";
import { expiryFromDays } from "@/lib/reseller";
import { PACKAGE_NAMES } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import type { ResellerStatus } from "@/lib/types";

interface PatchBody {
  status?: ResellerStatus;
  packages?: string[];
  password?: string;
  /** Extend or shorten from now. 0 clears the expiry entirely. */
  validityDays?: number;
  keyLimit?: number;
  deviceLocked?: boolean;
  /** Drop the device binding so the next sign-in re-claims the account. */
  resetLock?: boolean;
}

/** Statuses the owner may set directly. EXPIRED is derived, not assignable. */
const SETTABLE_STATUS: ResellerStatus[] = ["ACTIVE", "SUSPENDED", "PENDING APPROVAL"];

type Ctx = { params: Promise<{ username: string }> };

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  await requireOwner();
  const { username } = await ctx.params;
  const body = await readJson<PatchBody>(request);
  const ip = await clientIp();

  const hash = body.password ? await hashPassword(body.password) : null;
  if (body.password && body.password.length < 4) {
    throw new HttpError(400, "Password must be at least 4 characters.");
  }

  // Only these may be set by hand. EXPIRED is derived from the validity
  // date, never assigned directly -- accepting it here would let a request
  // pin an account EXPIRED with a future expiry, a state the rest of the
  // code never expects.
  if (body.status && !SETTABLE_STATUS.includes(body.status)) {
    throw new HttpError(400, `Status must be one of: ${SETTABLE_STATUS.join(", ")}.`);
  }

  await updateDb(async (db, tx) => {
    const match = findReseller(db, decodeURIComponent(username));
    if (!match) throw new HttpError(404, "Reseller not found.");

    // Set as each field below actually applies. A PATCH with no
    // recognised fields -- or one that only fails validation -- should
    // not wake every other dashboard.
    let changed = false;

    if (body.status) {
      changed = true;
      match.user.status = body.status;

      // A suspension has to reach an account that is already signed in.
      // Dropping its device rows ends every open session, so the next
      // request or dashboard poll shows the suspended screen instead of
      // the panel carrying on until the token expires.
      if (body.status !== "ACTIVE") {
        db.cheatExeDevices = db.cheatExeDevices.filter(
          (d) => (d.user.split(" ")[0] ?? "").toLowerCase() !== match.key.toLowerCase(),
        );
      }

      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Set ${match.key} status to ${body.status}`,
        ip,
      });
    }

    if (body.packages) {
      changed = true;
      match.user.packages = body.packages.filter((p) => PACKAGE_NAMES.includes(p));
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Updated permissions for ${match.key}`,
        ip,
      });
    }

    if (hash) {
      changed = true;
      match.user.pass = hash;
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Changed password for reseller ${match.key}`,
        ip,
      });
    }

    if (body.validityDays !== undefined) {
      const days = Number(body.validityDays);
      if (!Number.isInteger(days) || days < 0) {
        throw new HttpError(400, "Validity must be a whole number of days, 0 or more.");
      }
      changed = true;
      match.user.expiresAt = expiryFromDays(days);
      // Renewing a lapsed account is the point of setting a new validity,
      // so lift the EXPIRED status that stamped it.
      if (days > 0 && match.user.status === "EXPIRED") match.user.status = "ACTIVE";
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: days > 0 ? `Set ${match.key} validity to ${days} day(s)` : `Removed ${match.key} expiry`,
        ip,
      });
    }

    if (body.keyLimit !== undefined) {
      const limit = Number(body.keyLimit);
      if (!Number.isInteger(limit) || limit < 0) {
        throw new HttpError(400, "Key limit must be a whole number, 0 or more.");
      }
      changed = true;
      match.user.keyLimit = limit || undefined;
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: limit > 0 ? `Set ${match.key} key limit to ${limit}` : `Removed ${match.key} key limit`,
        ip,
      });
    }

    if (body.deviceLocked !== undefined) {
      changed = true;
      match.user.deviceLocked = body.deviceLocked;
      if (!body.deviceLocked) clearLock(match.user);
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `${body.deviceLocked ? "Enabled" : "Disabled"} device lock for ${match.key}`,
        ip,
      });
    }

    if (body.resetLock) {
      changed = true;
      clearLock(match.user);
      // End open sessions too, otherwise the machine being unbound keeps
      // working until its token expires and the reset achieves nothing.
      db.cheatExeDevices = db.cheatExeDevices.filter(
        (d) => (d.user.split(" ")[0] ?? "").toLowerCase() !== match.key.toLowerCase(),
      );
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Reset device lock (HWID) for reseller ${match.key}`,
        ip,
      });
    }

    if (changed) await ping("reseller", tx);
  });

  return NextResponse.json({ success: true });
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  await requireOwner();
  const { username } = await ctx.params;
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    const match = findReseller(db, decodeURIComponent(username));
    if (!match) throw new HttpError(404, "Reseller not found.");
    delete db.cheatExeUsers[match.key];
    // Drop any live session belonging to the deleted account.
    db.cheatExeDevices = db.cheatExeDevices.filter(
      (d) => d.user.split(" ")[0]?.toLowerCase() !== match.key.toLowerCase(),
    );
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: `Deleted reseller account: ${match.key}`,
      ip,
    });

    // The not-found case threw above, so reaching here always deleted
    // something.
    await ping("reseller", tx);
  });

  return NextResponse.json({ success: true });
});
