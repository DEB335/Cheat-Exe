import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";

/** Clears every session except the caller, without banning anyone. */
export const DELETE = route(async () => {
  const owner = await requireOwner();
  const ip = await clientIp();

  await updateDb((db) => {
    db.cheatExeDevices = db.cheatExeDevices.filter((d) => d.sessionId === owner.sessionId);
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the active device list",
      ip,
    });
  });

  return NextResponse.json({ success: true });
});
