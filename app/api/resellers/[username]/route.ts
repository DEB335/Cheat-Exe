import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, hashPassword, updateDb } from "@/lib/db";
import { PACKAGE_NAMES } from "@/lib/packages";
import type { ResellerStatus } from "@/lib/types";

interface PatchBody {
  status?: ResellerStatus;
  packages?: string[];
  password?: string;
}

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

  await updateDb((db) => {
    const match = findReseller(db, decodeURIComponent(username));
    if (!match) throw new HttpError(404, "Reseller not found.");

    if (body.status) {
      match.user.status = body.status;
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Set ${match.key} status to ${body.status}`,
        ip,
      });
    }

    if (body.packages) {
      match.user.packages = body.packages.filter((p) => PACKAGE_NAMES.includes(p));
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Updated permissions for ${match.key}`,
        ip,
      });
    }

    if (hash) {
      match.user.pass = hash;
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Changed password for reseller ${match.key}`,
        ip,
      });
    }
  });

  return NextResponse.json({ success: true });
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  await requireOwner();
  const { username } = await ctx.params;
  const ip = await clientIp();

  await updateDb((db) => {
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
  });

  return NextResponse.json({ success: true });
});
