import { NextResponse } from "next/server";

import { HttpError, clientIp, loadDb, requireOwner, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";
import { displayUser } from "@/lib/utils";

function checkEmulatorMaintenance(envVal?: string, dbActive?: boolean, dbReason?: string) {
  const envOn = /^(1|true|on|yes)$/i.test(envVal ?? process.env.EMULATOR_BYPASS_MAINTENANCE ?? "");
  if (envOn) {
    return {
      active: true,
      reason: "Switched on with EMULATOR_BYPASS_MAINTENANCE environment variable.",
    };
  }
  if (dbActive) {
    return {
      active: true,
      reason: dbReason ?? "Service is currently undergoing updates and maintenance.",
    };
  }
  return { active: false, reason: null };
}

export const GET = route(async () => {
  await requireUser();
  const db = await loadDb();
  const maintenance = checkEmulatorMaintenance(
    undefined,
    db.emulatorBypassMaintenance?.active,
    db.emulatorBypassMaintenance?.reason,
  );
  return NextResponse.json({ success: true, ...maintenance });
});

export const POST = route(async (request: Request) => {
  const owner = await requireOwner();
  const body = await readJson<{
    active: boolean;
    reason?: string;
    engine?: "V1" | "V2" | "ALL";
    v1Maintenance?: boolean;
    v2Maintenance?: boolean;
    recommended?: "V1" | "V2";
  }>(request);
  const ip = await clientIp();

  const nextActive = Boolean(body.active);
  const nextReason = body.reason?.trim() || "Service is currently undergoing updates and maintenance.";

  let updatedState = {};

  await updateDb(async (db, tx) => {
    db.emulatorBypassMaintenance = {
      active: nextActive,
      reason: nextReason,
      ...(body.engine ? { engine: body.engine } : {}),
      ...(body.v1Maintenance !== undefined ? { v1Maintenance: body.v1Maintenance } : {}),
      ...(body.v2Maintenance !== undefined ? { v2Maintenance: body.v2Maintenance } : {}),
      ...(body.recommended ? { recommended: body.recommended } : {}),
    };
    updatedState = db.emulatorBypassMaintenance;

    pushAudit(db, {
      user: displayUser(owner.username, owner.role),
      action: `${nextActive ? "Enabled" : "Disabled"} Emulator Bypass maintenance mode`,
      ip,
    });

    await ping("reseller", tx);
  });

  return NextResponse.json({ success: true, ...updatedState });
});
