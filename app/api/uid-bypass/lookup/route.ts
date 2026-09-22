import { NextResponse } from "next/server";

import { HttpError, clientIp, loadDb, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { canManageWhitelist } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import {
  MAINTENANCE,
  addWhitelist,
  daysUntil,
  listWhitelistSnapshot,
  removeWhitelist,
} from "@/lib/uid-api";
import { cleanRegion, cleanUid } from "@/lib/whitelist-input";
import { displayUser } from "@/lib/utils";

/** The throwaway validity a name costs. Given straight back. */
const PROBE_DAYS = 1;

/**
 * Names a UID without leaving it whitelisted.
 *
 * The provider has no lookup: `whitelist_uid` is the only action that
 * answers with a player's in-game name, and it whitelists them to do it.
 * So this buys a day and hands it back, which is what lets the whitelist
 * table go on meaning "what has been sold". Hiding the entry in the
 * page's state was the previous attempt, and it died on navigation --
 * the entry had been real all along.
 *
 * Everything below exists because the last step of that is a delete, and
 * a delete aimed at the wrong entry cuts off someone's customer. Nothing
 * here removes anything without positive evidence that this request is
 * what created it:
 *
 *   - a UID somebody else's owner row claims is refused outright;
 *   - a UID already on the provider's list is answered from the list and
 *     never touched;
 *   - a list that disagrees with its own stated count is not evidence of
 *     absence, so the probe is refused rather than guessed at;
 *   - and the entry is removed only if the expiry that comes back is the
 *     one-day expiry this request asked for. A longer one means the add
 *     landed on an entry that already existed.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  if (!canManageWhitelist(user)) {
    throw new HttpError(403, "The UID BYPASS package is required to manage the whitelist.");
  }
  if (MAINTENANCE) {
    throw new HttpError(503, "UID Bypass is under maintenance. Whitelisting is paused.");
  }

  const ip = await clientIp();
  const body = await readJson<{ uid?: unknown; region?: unknown }>(request);
  const uid = cleanUid(body.uid);
  const region = cleanRegion(body.region);

  // Checked before anything is spent or touched. The provider's list is
  // not filtered by owner, so without this a reseller could read another
  // reseller's customer -- and, worse, reach the probe path for a UID
  // that is not theirs to disturb.
  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  const mine = !owner || user.role === "OWNER" || owner === user.username.toLowerCase();
  if (!mine) throw new HttpError(403, "That UID was whitelisted by someone else.");

  const snapshot = await listWhitelistSnapshot();
  const existing = snapshot.entries.find((entry) => entry.uid === uid);

  // Already sold: answer from the list and change nothing.
  if (existing) {
    return NextResponse.json({
      success: true,
      uid,
      name: existing.name,
      region: existing.region,
      expireDate: existing.expireDate,
      alreadyWhitelisted: true,
    });
  }

  // Absence is only meaningful if the list is whole.
  if (!snapshot.trustworthy) {
    throw new HttpError(
      502,
      "The provider's list came back inconsistent, so this UID cannot be checked safely right now. Try again in a moment.",
    );
  }

  const added = await addWhitelist({ uid, region, days: PROBE_DAYS, note: "" });

  // Claimed before the removal is attempted. If the remove fails, or this
  // request dies between the two calls, the entry that is left is at
  // least attributable -- and therefore visible and deletable by whoever
  // made it, rather than an orphan nobody can see or clear.
  await updateDb(async (current) => {
    current.cheatExeWhitelistOwners[uid] = user.username.toLowerCase();
  });

  // The provider has been seen to accept an add for a UID it already held
  // and reset the expiry. The expiry coming back is the only evidence of
  // which of those happened, so it is what decides whether to delete.
  const left = daysUntil(added.expireDate);
  const isProbe = left !== null && left <= PROBE_DAYS + 1;

  let removed = false;
  if (isProbe) {
    for (let attempt = 0; attempt < 2 && !removed; attempt += 1) {
      try {
        removed = await removeWhitelist(uid);
      } catch {
        // Idempotent by construction -- a UID it does not hold answers
        // 404, not an error -- so a second go is safe.
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  await updateDb(async (current, tx) => {
    if (removed) delete current.cheatExeWhitelistOwners[uid];

    pushAudit(current, {
      user: displayUser(user.username, user.role),
      action: removed
        ? `Checked UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region}`
        : isProbe
          ? `Checked UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} -- the ${PROBE_DAYS}-day check entry could not be removed`
          : `Checked UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} -- it was already whitelisted and its validity was reset`,
      ip,
    });
    await ping("audit", tx);
  });

  // The name was bought either way, so it is always returned. Throwing
  // here would lose what the credit paid for and still leave the entry.
  return NextResponse.json({
    success: true,
    uid,
    region,
    name: added.name,
    expireDate: added.expireDate,
    alreadyWhitelisted: !isProbe,
    /** True when the check entry is still on the provider's list. */
    strayEntry: isProbe && !removed,
    /** True when the add landed on an entry that already existed. */
    resetExisting: !isProbe,
  });
});
