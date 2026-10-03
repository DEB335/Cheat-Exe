import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { releaseKey, type ReleaseResult } from "@/lib/hwid-release";
import { ping } from "@/lib/realtime";
import { displayUser } from "@/lib/utils";

interface LockBody {
  key?: string;
  locked?: unknown;
}

/**
 * Turns the HWID lock on a key on or off.
 *
 * Nothing is sent to the provider to do it, because it has nothing to
 * send: it binds every key to its first device and that is that. The
 * switch lives on the panel's own record, and the sweep acts on it --
 * for an unlocked key it keeps clearing the binding so the next device
 * can take it. Locking again simply stops the sweep: the device holding
 * the key keeps it, or the next one to log in takes it, as the provider
 * does by itself.
 *
 * The owner can switch any key. A reseller can switch only keys they
 * generated themselves, the same line the history view draws.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const body = await readJson<LockBody>(request);
  const key = (body.key ?? "").trim();

  if (!key) throw new HttpError(400, "Enter a valid license key first!");
  if (typeof body.locked !== "boolean") throw new HttpError(400, "Say whether to lock or unlock.");
  const locked = body.locked;

  const ip = await clientIp();
  await updateDb(async (db, tx) => {
    // Every row for the key, should history ever hold it twice, so the
    // sweep and the table cannot disagree about which one counts.
    const records = db.cheatExeKeyHistory.filter((r) => r.key === key);
    if (records.length === 0) throw new HttpError(404, "That key is not in the history.");

    if (user.role !== "OWNER") {
      const me = user.username.toLowerCase();
      if (!records.every((r) => r.creator.toLowerCase() === me)) {
        throw new HttpError(403, "You can only change keys you generated.");
      }
    }

    for (const record of records) record.hwidLock = locked;
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `${locked ? "Locked" : "Unlocked"} HWID on key: ${key}`,
      ip,
    });
    await ping("key", tx);
  });

  // Unlocking frees the current device straight away rather than at the
  // next sweep, so the customer can move machines as soon as it is said.
  // After the write, not inside it: the lookup and reset are two
  // provider round trips, and the row lock should not wait on them.
  // releaseKey reads the lock again just before resetting, so a re-lock
  // from another tab landing in between wins, and answers "locked".
  let release: ReleaseResult | undefined;
  if (!locked) release = await releaseKey(key);

  return NextResponse.json({ success: true, hwidLock: locked, release });
});
