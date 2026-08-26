import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";

/** Empties the vault. Does not reactivate the suspended accounts. */
export const DELETE = route(async () => {
  await requireOwner();
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    // An already-empty vault has nothing worth announcing.
    if (db.cheatExeBannedUsers.length === 0) return;

    db.cheatExeBannedUsers = [];
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the banned and kicked vault",
      ip,
    });
    await ping("ban", tx);
  });

  return NextResponse.json({ success: true });
});
