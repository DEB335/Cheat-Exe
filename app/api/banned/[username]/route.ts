import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { findReseller, updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";

type Ctx = { params: Promise<{ username: string }> };

/**
 * DELETE /api/banned/:username?restore=1
 * With restore=1 the account is reactivated (Unban); without it the
 * vault record is simply discarded.
 */
export const DELETE = route(async (request: Request, ctx: Ctx) => {
  await requireOwner();
  const { username: raw } = await ctx.params;
  const username = decodeURIComponent(raw);
  const restore = new URL(request.url).searchParams.get("restore") === "1";
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    const before = db.cheatExeBannedUsers.length;
    db.cheatExeBannedUsers = db.cheatExeBannedUsers.filter(
      (b) => b.username.toLowerCase() !== username.toLowerCase(),
    );
    const removed = db.cheatExeBannedUsers.length < before;

    let restored = false;
    if (restore) {
      const match = findReseller(db, username);
      if (match) {
        match.user.status = "ACTIVE";
        restored = true;
      }
    }

    // A restore with no reseller to restore, over a record that was
    // already gone, changed nothing.
    if (!removed && !restored) return;

    pushAudit(db, {
      user: "Owner (OWNER)",
      action: restore
        ? `Unbanned and restored access for: ${username}`
        : `Deleted vault record for: ${username}`,
      ip,
    });
    await ping("ban", tx);
  });

  return NextResponse.json({ success: true });
});
