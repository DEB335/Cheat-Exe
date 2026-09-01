import { NextResponse } from "next/server";

import { HttpError, clientIp, loadDb, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { MAX_WHITELIST_DAYS, canManageWhitelist } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import type { SessionUser, WhitelistEntry } from "@/lib/types";
import { addWhitelist, listWhitelist, removeWhitelist } from "@/lib/uid-api";
import { displayUser } from "@/lib/utils";

/** Upstream's own rule, enforced here so a bad UID never costs a credit. */
const UID_PATTERN = /^\d{8,}$/;

async function requireWhitelistAccess(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManageWhitelist(user)) {
    throw new HttpError(403, "The UID BYPASS package is required to manage the whitelist.");
  }
  return user;
}

function cleanUid(value: unknown): string {
  const uid = String(value ?? "").trim();
  if (!UID_PATTERN.test(uid)) throw new HttpError(400, "UID must be at least 8 digits.");
  return uid;
}

function cleanDays(value: unknown): number {
  const days = Number(value ?? MAX_WHITELIST_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WHITELIST_DAYS) {
    throw new HttpError(400, `Validity must be a whole number of days from 1 to ${MAX_WHITELIST_DAYS}.`);
  }
  return days;
}

function cleanName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 40);
}

/**
 * Narrows a list to what this user may act on.
 *
 * A UID with no recorded owner is the owner's: entries predating this
 * map, or added straight from the Discord bot or the TX999 panel, have
 * nobody to attribute them to and must not fall to whoever asks first.
 */
function visibleTo(
  user: SessionUser,
  entries: WhitelistEntry[],
  owners: Record<string, string>,
): WhitelistEntry[] {
  if (user.role === "OWNER") return entries;
  const me = user.username.toLowerCase();
  return entries.filter((entry) => owners[entry.uid] === me);
}

export const GET = route(async () => {
  const user = await requireWhitelistAccess();
  const db = await loadDb();

  const entries = visibleTo(user, await listWhitelist(), db.cheatExeWhitelistOwners);

  return NextResponse.json({ success: true, entries });
});

export const POST = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  const ip = await clientIp();

  const body = await readJson<{ uid?: unknown; name?: unknown; days?: unknown }>(request);
  const uid = cleanUid(body.uid);
  const name = cleanName(body.name);
  const days = cleanDays(body.days);

  // Upstream first: it owns the "UID already exists" answer, and a
  // failure here must not leave an ownership row behind for a UID that
  // was never whitelisted.
  const expireDate = await addWhitelist(uid, name, days);

  await updateDb(async (db, tx) => {
    db.cheatExeWhitelistOwners[uid] = user.username.toLowerCase();
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Whitelisted UID ${uid}${name ? ` (${name})` : ""} for ${days} day${days === 1 ? "" : "s"}`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, expireDate });
});

/**
 * Re-issues a UID with a new validity, and optionally a new name.
 *
 * There is no update action upstream, and `reseller_add` refuses a UID
 * it already holds, so the only way through is remove-then-add. That
 * sequence has a window where the customer is not whitelisted, which is
 * why it runs here rather than as two calls from the browser: back to
 * back on the server the gap is milliseconds, and a failed re-add is
 * retried once before anyone is told about it.
 *
 * If the re-add still fails the UID really is gone, and the message says
 * so plainly -- there is nothing to roll back to.
 */
export const PATCH = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  const ip = await clientIp();

  const body = await readJson<{ uid?: unknown; name?: unknown; days?: unknown }>(request);
  const uid = cleanUid(body.uid);
  const name = cleanName(body.name);
  const days = cleanDays(body.days);

  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  if (user.role !== "OWNER" && owner !== user.username.toLowerCase()) {
    throw new HttpError(403, "That UID was whitelisted by someone else.");
  }

  await removeWhitelist(uid);

  let expireDate: string;
  try {
    expireDate = await addWhitelist(uid, name, days);
  } catch {
    try {
      expireDate = await addWhitelist(uid, name, days);
    } catch (err) {
      await updateDb(async (current, tx) => {
        delete current.cheatExeWhitelistOwners[uid];
        pushAudit(current, {
          user: displayUser(user.username, user.role),
          action: `Failed to re-issue UID ${uid} -- it is no longer whitelisted`,
          ip,
        });
        await ping("audit", tx);
      });
      throw new HttpError(
        502,
        `UID ${uid} was removed but could not be re-added (${(err as Error).message}). It is not whitelisted -- add it again.`,
      );
    }
  }

  await updateDb(async (current, tx) => {
    current.cheatExeWhitelistOwners[uid] = owner ?? user.username.toLowerCase();
    pushAudit(current, {
      user: displayUser(user.username, user.role),
      action: `Re-issued UID ${uid}${name ? ` (${name})` : ""} for ${days} day${days === 1 ? "" : "s"}`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, expireDate });
});

export const DELETE = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  const ip = await clientIp();

  const uid = cleanUid(new URL(request.url).searchParams.get("uid"));

  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  if (user.role !== "OWNER" && owner !== user.username.toLowerCase()) {
    throw new HttpError(403, "That UID was whitelisted by someone else.");
  }

  await removeWhitelist(uid);

  await updateDb(async (current, tx) => {
    delete current.cheatExeWhitelistOwners[uid];
    pushAudit(current, {
      user: displayUser(user.username, user.role),
      action: `Removed UID ${uid} from the whitelist`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid });
});
