import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";
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
  await updateDb(async (db, tx) => {
    const before = db.cheatExeKeyHistory.length;

    if (scope === "owner") {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => {
        if (k.package === "EMULATOR BYPASS") return true;
        const c = (k.creator || "").trim().toLowerCase();
        const isOwnerKey = c === "admin" || c === "owner" || c.startsWith("owner (") || c.startsWith("owner ");
        return !isOwnerKey;
      });
      if (db.cheatExeKeyHistory.length === before) return;
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared Owner key history",
        ip,
      });
    } else if (user.role === "OWNER") {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => {
        if (k.package === "EMULATOR BYPASS") return true;
        const c = (k.creator || "").trim().toLowerCase();
        const isOwnerKey = c === "admin" || c === "owner" || c.startsWith("owner (") || c.startsWith("owner ");
        return isOwnerKey;
      });
      if (db.cheatExeKeyHistory.length === before) return;
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared Reseller key history",
        ip,
      });
    } else {
      const me = user.username.toLowerCase();
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => {
        if (k.package === "EMULATOR BYPASS") return true;
        const c = (k.creator || "").trim().toLowerCase();
        const isMyKey = c === me || c.startsWith(`${me} `) || c.startsWith(`${me}(`);
        return !isMyKey;
      });
      if (db.cheatExeKeyHistory.length === before) return;
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: "Cleared own key history",
        ip,
      });
    }

    await ping("key", tx);
  });

  return NextResponse.json({ success: true });
});
