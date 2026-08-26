import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { callLicenseApi, type LicenseEnvelope } from "@/lib/license-api";
import { ping } from "@/lib/realtime";
import type { KeyAction } from "@/lib/types";
import { displayUser } from "@/lib/utils";

const ACTIONS: KeyAction[] = ["reset_hwid", "ban_key", "unban_key", "delete_key"];

interface ManageBody {
  action?: string;
  key?: string;
}

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const body = await readJson<ManageBody>(request);
  const key = (body.key ?? "").trim();
  const action = body.action as KeyAction;

  if (!key) throw new HttpError(400, "Enter a valid license key first!");
  if (!ACTIONS.includes(action)) throw new HttpError(400, "Unsupported action.");

  const data = await callLicenseApi<LicenseEnvelope>(action, { key });

  const ip = await clientIp();
  // Only mirror the change locally if the upstream actually applied it.
  if (!data.success) {
    return NextResponse.json({ success: false, message: data.message ?? "Action failed" });
  }

  await updateDb(async (db, tx) => {
    if (action === "delete_key") {
      db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => k.key !== key);
    }
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Successfully executed ${action} on key: ${key}`,
      ip,
    });

    // The early return above covers a failed upstream call, so reaching
    // here always means the action actually applied.
    await ping("key", tx);
  });

  return NextResponse.json({ success: true, message: data.message ?? "Done" });
});
