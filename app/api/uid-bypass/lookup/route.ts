import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { canManageWhitelist } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import { MAINTENANCE, addWhitelist, listWhitelist, removeWhitelist } from "@/lib/uid-api";
import { cleanRegion, cleanUid } from "@/lib/whitelist-input";
import { displayUser } from "@/lib/utils";

/** The throwaway validity a name costs. Given straight back. */
const PROBE_DAYS = 1;

/**
 * Names a UID without leaving it whitelisted.
 *
 * The provider has no lookup: `whitelist_uid` is the only action that
 * answers with a player's in-game name, and it whitelists them to do it.
 * So this buys one day and immediately hands it back, which is what lets
 * the whitelist table keep meaning "what has been sold". The earlier
 * version left the entry in place and hid it in the page's state, and
 * that hiding died the moment the operator navigated -- the entry was
 * always really there, which is the bug this replaces.
 *
 * The existence check is not an optimisation. It decides whether the
 * entry about to be removed is one this request created or one a
 * customer is paying for, so it asks the provider rather than trusting
 * the list the browser happens to be holding.
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

  // Already sold to someone: answer from the list and touch nothing. A
  // removal here would cut off a paying customer to satisfy a search.
  const existing = (await listWhitelist()).find((entry) => entry.uid === uid);
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

  const added = await addWhitelist({ uid, region, days: PROBE_DAYS, note: "" });

  // The add succeeded, so something is up there now and this is the only
  // code that knows it should not be. A failure to remove is reported
  // rather than thrown: the name was still read, and telling the
  // operator "search failed" while leaving an entry behind would be the
  // worst of both.
  let removed = true;
  try {
    await removeWhitelist(uid);
  } catch {
    removed = false;
  }

  await updateDb(async (db, tx) => {
    // Only if it is still there. An owner row for an entry that does not
    // exist would make the panel refuse a later add by someone else.
    if (!removed) db.cheatExeWhitelistOwners[uid] = user.username.toLowerCase();

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: removed
        ? `Checked UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region}`
        : `Checked UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} -- the ${PROBE_DAYS}-day check entry could not be removed`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({
    success: true,
    uid,
    region,
    name: added.name,
    alreadyWhitelisted: false,
    /** True when the check entry is still on the provider's list. */
    strayEntry: !removed,
  });
});
