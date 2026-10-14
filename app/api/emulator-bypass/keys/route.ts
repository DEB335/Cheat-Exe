import { NextResponse } from "next/server";
import { HttpError, clientIp, requireUserWithDb } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { deleteLibKey, getLibKeyInfo, resetLibHwid } from "@/lib/emulator-bypass-api";
import { ping } from "@/lib/realtime";
import { displayUser } from "@/lib/utils";

export const GET = route(async (request: Request) => {
  await requireUserWithDb();
  const url = new URL(request.url);
  const targetKey = url.searchParams.get("key")?.trim();
  const engine = (url.searchParams.get("engine")?.toUpperCase() === "V1" ? "V1" : "V2") as "V1" | "V2";

  if (!targetKey) {
    throw new HttpError(400, "Key parameter is required.");
  }

  const info = await getLibKeyInfo(targetKey, engine);
  return NextResponse.json(info);
});

export const DELETE = route(async (request: Request) => {
  const { user, db: currentDb } = await requireUserWithDb();
  const url = new URL(request.url);
  const targetKey = url.searchParams.get("key")?.trim();
  const ip = await clientIp();

  if (!targetKey) {
    throw new HttpError(400, "Key parameter is required.");
  }

  const existing = currentDb.cheatExeKeyHistory.find((k) => k.key === targetKey);
  if (!existing && user.role !== "OWNER") {
    throw new HttpError(404, "Key not found.");
  }

  if (
    user.role !== "OWNER" &&
    existing &&
    existing.creator.toLowerCase() !== user.username.toLowerCase()
  ) {
    throw new HttpError(403, "You do not have permission to delete this key.");
  }

  const engine = (existing?.engine === "V1" ? "V1" : "V2") as "V1" | "V2";

  // Upstream deletion
  try {
    await deleteLibKey(targetKey, engine);
  } catch (err) {
    // If the key is already deleted or not found upstream, allow local deletion to clean history
    const msg = (err as Error).message || "";
    if (!msg.toLowerCase().includes("not found")) {
      throw err;
    }
  }

  await updateDb(async (db, tx) => {
    db.cheatExeKeyHistory = db.cheatExeKeyHistory.filter((k) => {
      if (k.key !== targetKey) return true;
      if (user.role === "OWNER") return false;
      const isMine = k.creator.toLowerCase() === user.username.toLowerCase();
      return !isMine;
    });

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Deleted Lib Bypass key ${targetKey} (${engine})`,
      ip,
    });

    await ping("key", tx);
  });

  return NextResponse.json({ success: true, key: targetKey });
});

export const PATCH = route(async (request: Request) => {
  const { user, db: currentDb } = await requireUserWithDb();
  const body = await readJson<{ key: string }>(request);
  const targetKey = body.key?.trim();
  const ip = await clientIp();

  if (!targetKey) {
    throw new HttpError(400, "Key is required.");
  }

  const existing = currentDb.cheatExeKeyHistory.find((k) => k.key === targetKey);
  if (!existing) {
    throw new HttpError(404, "Key not found.");
  }

  if (
    user.role !== "OWNER" &&
    existing.creator.toLowerCase() !== user.username.toLowerCase()
  ) {
    throw new HttpError(403, "You do not have permission to reset this key.");
  }

  const engine = (existing.engine === "V1" ? "V1" : "V2") as "V1" | "V2";

  // Upstream HWID reset
  const upstream = await resetLibHwid(targetKey, engine);

  await updateDb(async (db, tx) => {
    const record = db.cheatExeKeyHistory.find((k) => k.key === targetKey);
    if (record) {
      record.hwidLock = false;
    }

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Reset HWID lock for Lib Bypass key ${targetKey} (${engine})`,
      ip,
    });

    await ping("key", tx);
  });

  return NextResponse.json({
    success: true,
    message: upstream.message || `HWID reset for ${targetKey}.`,
  });
});
