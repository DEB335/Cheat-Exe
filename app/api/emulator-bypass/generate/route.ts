import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUserWithDb } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, updateDb } from "@/lib/db";
import { generateLibKey } from "@/lib/emulator-bypass-api";
import { ping } from "@/lib/realtime";
import type { KeyRecord } from "@/lib/types";
import { displayUser, formatTimestamp, isCreatorMatch } from "@/lib/utils";

interface GenerateBody {
  days: number;
  hwidLock?: boolean;
  keyName?: string;
  engine?: string;
  note?: string;
  clientDate?: string;
}

function formatExpiryDate(days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export const POST = route(async (request: Request) => {
  const { user, db: currentDb } = await requireUserWithDb();
  const body = await readJson<GenerateBody>(request);
  const ip = await clientIp();

  const days = Number(body.days);
  if (!Number.isInteger(days) || days <= 0) {
    throw new HttpError(400, "Invalid validity duration.");
  }

  // Reseller permission checks
  if (user.role === "RESELLER") {
    const match = findReseller(currentDb, user.username);
    if (!match) throw new HttpError(404, "Reseller account not found.");

    if (!match.user.emulatorBypassAccess) {
      throw new HttpError(403, "Emulator Bypass access is not granted for your account.");
    }

    const allowed = match.user.emulatorAllowedDays ?? [1, 3, 7];
    if (!allowed.includes(days)) {
      throw new HttpError(403, `The ${days} Day preset is locked for your account.`);
    }

    const limit = match.user.emulatorCredits ?? 0;
    if (limit > 0) {
      const used = currentDb.cheatExeKeyHistory.filter(
        (k) =>
          k.package === "EMULATOR BYPASS" &&
          isCreatorMatch(k.creator, user.username),
      ).length;

      if (used >= limit) {
        throw new HttpError(400, "Insufficient Emulator Bypass credits remaining. Quota reached.");
      }
    }
  }

  const engine = (body.engine === "V1" ? "V1" : "V2") as "V1" | "V2";
  const maint = currentDb.emulatorBypassMaintenance;
  const isV1Maint = Boolean(
    maint?.v1Maintenance ||
      (maint?.active && (maint?.engine === "V1" || maint?.engine === "ALL")),
  );
  const isV2Maint = Boolean(
    maint?.v2Maintenance ||
      (maint?.active && (maint?.engine === "V2" || maint?.engine === "ALL" || !maint?.engine)),
  );

  if (user.role !== "OWNER") {
    if (maint?.active && (maint.engine === "ALL" || !maint.engine)) {
      throw new HttpError(503, maint.reason || "Emulator Bypass is under maintenance. Key generation is paused.");
    }
    if (engine === "V1" && isV1Maint) {
      throw new HttpError(503, "Version 1 (V1) is currently under maintenance.");
    }
    if (engine === "V2" && isV2Maint) {
      throw new HttpError(503, "Version 2 (V2) is currently under maintenance.");
    }
  }

  const customName = body.keyName?.trim().toUpperCase();
  if (customName) {
    const exists = currentDb.cheatExeKeyHistory.some(
      (k) => k.key.toUpperCase() === customName,
    );
    if (exists) {
      throw new HttpError(409, `License key "${customName}" already exists. Please choose a different name.`);
    }
  }

  const note = body.note?.trim()
    ? body.note.trim()
    : `Lib Bypass Client [${engine === "V2" ? "V2 Sensix" : "V1 Bot"}]`;

  // Upstream Live API Call to prtvshow.online
  const upstream = await generateLibKey({
    engine,
    days,
    count: 1,
    customKey: customName,
    note,
  });

  const generatedKey = upstream.keys?.[0] || customName || "";
  if (!generatedKey) {
    throw new HttpError(502, "Upstream API did not return a generated key.");
  }

  await updateDb(async (db, tx) => {
    const record: KeyRecord = {
      key: generatedKey,
      keyName: customName || generatedKey,
      package: "EMULATOR BYPASS",
      engine,
      duration: String(days),
      appliedDays: days,
      expiry: formatExpiryDate(days),
      creator: user.role === "OWNER" ? "Owner (OWNER)" : `${user.username} (RESELLER)`,
      note,
      date: body.clientDate?.trim() || formatTimestamp(),
      hwidLock: body.hwidLock ?? true,
    };

    db.cheatExeKeyHistory.unshift(record);

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Generated Lib Bypass key ${generatedKey} (${days} Days, ${engine})`,
      ip,
    });

    await ping("key", tx);
  });

  return NextResponse.json({ success: true, key: generatedKey });
});
