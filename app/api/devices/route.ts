import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";

/** Clears every session except the caller, without banning anyone. */
export const DELETE = route(async () => {
  const owner = await requireOwner();
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    const before = db.cheatExeDevices.length;
    db.cheatExeDevices = db.cheatExeDevices.filter((d) => d.sessionId === owner.sessionId);
    // Nothing to tell anyone if the caller's own session was the only one.
    if (db.cheatExeDevices.length === before) return;

    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the active device list",
      ip,
    });
    await ping("device", tx);
  });

  return NextResponse.json({ success: true });
});
