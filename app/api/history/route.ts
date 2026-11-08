import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { clearAuditAction, inClearScope } from "@/lib/history-scope";
import { ping } from "@/lib/realtime";
import { displayUser } from "@/lib/utils";

/**
 * DELETE /api/history?scope=owner|reseller
 *
 * Owners may clear either list. A reseller may only clear their own keys.
 *
 * This empties the panel's own list -- the shared database every page
 * reads -- and nothing else. The keys themselves are left alone at the
 * provider: a cleared row means the panel has let go of it, not that the
 * license stopped working. A key is terminated at the license API only
 * through the explicit per-key Delete action in Manage.
 *
 * The scope is defined once, in `inClearScope`, and shared with the
 * client's optimistic mirror so the row that disappears is the row the
 * route drops. Every other tab and page hears about it over realtime.
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

  const actor = { role: user.role, username: user.username };

  const ip = await clientIp();
  let cleared = 0;
  await updateDb(async (db, tx) => {
    const before = db.cheatExeKeyHistory.length;
    db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => !inClearScope(k, scope, actor));
    cleared = before - db.cheatExeKeyHistory.length;

    // Nothing moved: no audit line and no ping, exactly as before.
    if (cleared === 0) return;

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: clearAuditAction(scope, actor),
      ip,
    });

    await ping("key", tx);
  });

  return NextResponse.json({ success: true, cleared });
});
