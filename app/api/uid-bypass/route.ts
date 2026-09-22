import { NextResponse } from "next/server";

import { HttpError, clientIp, loadDb, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { canManageWhitelist } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import type { SessionUser, WhitelistEntry } from "@/lib/types";
import { MAINTENANCE, addWhitelist, listWhitelist, removeWhitelist } from "@/lib/uid-api";
import { cleanDays, cleanNote, cleanRegion, cleanUid } from "@/lib/whitelist-input";
import { displayUser } from "@/lib/utils";

async function requireWhitelistAccess(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManageWhitelist(user)) {
    throw new HttpError(403, "The UID BYPASS package is required to manage the whitelist.");
  }
  return user;
}

/**
 * Refuses the write paths while maintenance is on.
 *
 * Separate from the read, which answers with a maintenance flag rather
 * than an error: the page has to render something, and a button that
 * spends a credit has to not work.
 */
function assertAvailable(): void {
  if (MAINTENANCE) {
    throw new HttpError(503, "UID Bypass is under maintenance. Whitelisting is paused.");
  }
}

/**
 * Narrows a list to what this user may act on.
 *
 * A UID with no recorded owner is the owner's: entries predating this
 * map, or added straight from the TX999 panel, have
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

  if (MAINTENANCE) {
    return NextResponse.json({
      success: true,
      entries: [],
      maintenance: true,
      reason: "Switched on here with UID_BYPASS_MAINTENANCE.",
    });
  }

  try {
    const entries = visibleTo(user, await listWhitelist(), db.cheatExeWhitelistOwners);
    return NextResponse.json({ success: true, entries, maintenance: false });
  } catch (err) {
    // A provider that is unreachable, or a key it will not take, is a
    // state of the service rather than a fault in this request -- so it
    // is reported as one instead of thrown, and the page shows the
    // maintenance notice rather than a red line above a form that
    // cannot work. Anything in the 400s is still a real error: those
    // are answers about the request, not about the service.
    if (err instanceof HttpError && err.status >= 500) {
      return NextResponse.json({
        success: true,
        entries: [],
        maintenance: true,
        reason: err.message,
      });
    }
    throw err;
  }
});

export const POST = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  assertAvailable();
  const ip = await clientIp();

  const body = await readJson<{
    uid?: unknown;
    note?: unknown;
    region?: unknown;
    days?: unknown;
  }>(request);
  const uid = cleanUid(body.uid);
  const note = cleanNote(body.note);
  const region = cleanRegion(body.region);
  const days = cleanDays(body.days);

  // Upstream first: it owns both the "UID already whitelisted" answer and
  // the check against the game, and a failure here must not leave an
  // ownership row behind for a UID that was never whitelisted.
  const added = await addWhitelist({ uid, region, days, note });

  await updateDb(async (db, tx) => {
    db.cheatExeWhitelistOwners[uid] = user.username.toLowerCase();
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Whitelisted UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} for ${days} day${days === 1 ? "" : "s"}`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, region, ...added });
});

/**
 * Re-issues a UID with a new validity, region or note.
 *
 * There is no update action upstream, and `whitelist_uid` refuses a UID
 * that is already active ("This Account ID is already active"), so the
 * only way through is remove-then-add. That sequence has a window where
 * the customer is not whitelisted, which is why it runs here rather than
 * as two calls from the browser: back to back on the server the gap is
 * milliseconds, and a failed re-add is retried once before anyone is
 * told about it.
 *
 * A UID the provider does not hold is no obstacle -- `removeWhitelist`
 * reports that rather than throwing -- so an entry that fell off upstream
 * is repaired by this rather than being stuck un-editable.
 *
 * If the re-add still fails the UID really is gone, and the message says
 * so plainly -- there is nothing to roll back to.
 */
export const PATCH = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  assertAvailable();
  const ip = await clientIp();

  const body = await readJson<{
    uid?: unknown;
    note?: unknown;
    region?: unknown;
    days?: unknown;
  }>(request);
  const uid = cleanUid(body.uid);
  const note = cleanNote(body.note);
  const region = cleanRegion(body.region);
  const days = cleanDays(body.days);

  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  if (user.role !== "OWNER" && owner !== user.username.toLowerCase()) {
    throw new HttpError(403, "That UID was whitelisted by someone else.");
  }

  await removeWhitelist(uid);

  let added;
  try {
    added = await addWhitelist({ uid, region, days, note });
  } catch {
    try {
      added = await addWhitelist({ uid, region, days, note });
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
      action: `Re-issued UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} for ${days} day${days === 1 ? "" : "s"}`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, region, ...added });
});

export const DELETE = route(async (request: Request) => {
  const user = await requireWhitelistAccess();
  assertAvailable();
  const ip = await clientIp();

  const uid = cleanUid(new URL(request.url).searchParams.get("uid"));

  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  if (user.role !== "OWNER" && owner !== user.username.toLowerCase()) {
    throw new HttpError(403, "That UID was whitelisted by someone else.");
  }

  // `false` means upstream never had it -- a stale row on this side. The
  // ownership row still goes, and the audit line says which happened, so
  // a list that drifted from the provider leaves a trace.
  const existed = await removeWhitelist(uid);

  await updateDb(async (current, tx) => {
    delete current.cheatExeWhitelistOwners[uid];
    pushAudit(current, {
      user: displayUser(user.username, user.role),
      action: existed
        ? `Removed UID ${uid} from the whitelist`
        : `Cleared stale UID ${uid} -- the provider did not have it`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, existed });
});
