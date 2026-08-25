import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";

/** Empties the vault. Does not reactivate the suspended accounts. */
export const DELETE = route(async () => {
  await requireOwner();
  const ip = await clientIp();

  await updateDb((db) => {
    db.cheatExeBannedUsers = [];
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the banned and kicked vault",
      ip,
    });
  });

  return NextResponse.json({ success: true });
});
