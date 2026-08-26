import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";

export const DELETE = route(async () => {
  await requireOwner();
  const ip = await clientIp();

  await updateDb(async (db, tx) => {
    db.cheatExeAuditLogs = [];
    // pushAudit always appends the "cleared" entry itself, so the log is
    // never actually empty afterwards -- this always changes something.
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the system audit log",
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true });
});
