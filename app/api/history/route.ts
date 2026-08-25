import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { displayUser } from "@/lib/utils";

/**
 * DELETE /api/history?scope=owner|reseller
 * Owners may clear either list. A reseller may only clear their own keys.
 */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser();
  const scope = new URL(request.url).searchParams.get("scope") ?? "owner";

  if (scope !== "owner" && scope !== "reseller") {
    throw new HttpError(400, "scope must be 'owner' or 'reseller'.");
  }
  if (user.role !== "OWNER" && scope === "owner") {
    throw new HttpError(403, "Owner access required");
  }

  const ip = await clientIp();
  await updateDb((db) => {
    if (scope === "owner") {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => k.creator !== "admin");
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared Owner key history",
        ip,
      });
    } else if (user.role === "OWNER") {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => k.creator === "admin");
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared Reseller key history",
        ip,
      });
    } else {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => k.creator !== user.username);
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared own key history",
        ip,
      });
    }
  });

  return NextResponse.json({ success: true });
});
