import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { findReseller, updateDb } from "@/lib/db";
import type { BannedUser } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

type Ctx = { params: Promise<{ sessionId: string }> };

/**
 * Kick: ends the session and files the account in the banned vault.
 * Passwords are bcrypt hashes now, so the vault records a placeholder
 * rather than a recoverable secret.
 */
export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const owner = await requireOwner();
  const { sessionId } = await ctx.params;
  const ip = await clientIp();

  const kicked = await updateDb((db) => {
    const index = db.cheatExeDevices.findIndex((d) => d.sessionId === sessionId);
    if (index === -1) throw new HttpError(404, "Session not found.");

    const device = db.cheatExeDevices[index]!;
    if (device.sessionId === owner.sessionId) {
      throw new HttpError(400, "You cannot kick your own session.");
    }

    const cleanUser = device.user.split(" ")[0] ?? device.user;
    const isOwnerSession = device.user.includes("OWNER");
    const match = isOwnerSession ? null : findReseller(db, cleanUser);

    const record: BannedUser = {
      username: cleanUser,
      password: "",
      role: isOwnerSession ? "OWNER" : "RESELLER",
      packages: match?.user.packages ?? [],
      ip: device.ip,
      device: device.device,
      kickedTime: formatTimestamp(),
      hwid: device.hwid,
      fingerprint: device.fingerprint,
    };

    db.cheatExeBannedUsers.unshift(record);
    db.cheatExeDevices.splice(index, 1);

    // Banning also suspends the account so it cannot sign back in.
    if (match) match.user.status = "SUSPENDED";

    pushAudit(db, {
      user: "Owner (OWNER)",
      action: `Kicked and banned session for user: ${cleanUser} (${device.ip})`,
      ip,
    });

    return cleanUser;
  });

  return NextResponse.json({ success: true, username: kicked });
});
