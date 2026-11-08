import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUserWithDb } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, updateDb } from "@/lib/db";
import {
  LibMaintenanceError,
  generateLibKey,
  type GenerateLibKeyResponse,
} from "@/lib/emulator-bypass-api";
import { deriveEmulatorStatus, pruneExpiredMaintenance, withEngineMaintenance } from "@/lib/emulator-status";
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
      const historyUsed = currentDb.cheatExeKeyHistory.filter(
        (k) =>
          k.package === "EMULATOR BYPASS" &&
          isCreatorMatch(k.creator, user.username),
      ).length;
      const used = Math.max(match.user.emulatorCreditsUsed ?? 0, historyUsed);

      if (used >= limit) {
        throw new HttpError(400, "Insufficient Emulator Bypass credits remaining. Quota reached.");
      }
    }
  }

  const engine = (body.engine === "V1" ? "V1" : "V2") as "V1" | "V2";
  // Pruned first: a lock that has lapsed is no lock, so a stale flag must
  // not block an attempt the panel is already willing to offer.
  const maint = pruneExpiredMaintenance(currentDb.emulatorBypassMaintenance);
  const stored = deriveEmulatorStatus(maint);

  if (user.role !== "OWNER") {
    if (stored.all) {
      throw new HttpError(503, maint?.reason || "Emulator Bypass is under maintenance. Key generation is paused.");
    }
    if (engine === "V1" && stored.v1) {
      throw new HttpError(503, "Version 1 (V1) is currently under maintenance.");
    }
    if (engine === "V2" && stored.v2) {
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
  let upstream: GenerateLibKeyResponse;
  try {
    upstream = await generateLibKey({
      engine,
      days,
      count: 1,
      customKey: customName,
      note,
    });
  } catch (err) {
    // A maintenance refusal is the only moment the provider tells us which
    // engine is down -- and which one it recommends instead. Record it and
    // ring the doorbell, so the overview and the emulator page raise their
    // notices the instant this returns, with no reload anywhere. The error
    // is rethrown unchanged: the caller still gets the 503 and its message.
    if (err instanceof LibMaintenanceError) {
      await updateDb(async (db, tx) => {
        db.emulatorBypassMaintenance = withEngineMaintenance(
          db.emulatorBypassMaintenance,
          err.engine,
          true,
          { reason: err.message, recommended: err.recommended },
        );
        await ping("reseller", tx);
      });
    }
    throw err;
  }

  const generatedKey = upstream.keys?.[0] || customName || "";
  if (!generatedKey) {
    throw new HttpError(502, "Upstream API did not return a generated key.");
  }

  await updateDb(async (db, tx) => {
    // A key this engine just minted is proof it is up. Clear any
    // maintenance we were holding for it, so the notices come down
    // everywhere as soon as that is known.
    db.emulatorBypassMaintenance = withEngineMaintenance(
      db.emulatorBypassMaintenance,
      engine,
      false,
    );

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

    if (user.role === "RESELLER") {
      const match = findReseller(db, user.username);
      if (match) {
        const historyUsed = db.cheatExeKeyHistory.filter(
          (k) =>
            k.package === "EMULATOR BYPASS" &&
            isCreatorMatch(k.creator, user.username),
        ).length;
        const prevUsed = Math.max(match.user.emulatorCreditsUsed ?? 0, historyUsed - 1);
        match.user.emulatorCreditsUsed = prevUsed + 1;
      }
    }

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Generated Lib Bypass key ${generatedKey} (${days} Days, ${engine})`,
      ip,
    });

    await ping("key", tx);
    await ping("reseller", tx);
  });

  return NextResponse.json({ success: true, key: generatedKey });
});
