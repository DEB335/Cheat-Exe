import { NextResponse } from "next/server";

import { clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";

export const DELETE = route(async () => {
  await requireOwner();
  const ip = await clientIp();

  await updateDb((db) => {
    db.cheatExeAuditLogs = [];
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: "Cleared the system audit log",
      ip,
    });
  });

  return NextResponse.json({ success: true });
});
