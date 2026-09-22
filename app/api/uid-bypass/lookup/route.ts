import { NextResponse } from "next/server";

import { HttpError, clientIp, loadDb, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { canManageWhitelist } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import { MAINTENANCE, addWhitelist } from "@/lib/uid-api";
import { cleanRegion, cleanUid } from "@/lib/whitelist-input";
import { displayUser } from "@/lib/utils";

/** The throwaway validity a verification buys. Replaced by the re-issue. */
const PROBE_DAYS = 1;

/**
 * Names a UID by whitelisting it for a single day.
 *
 * The provider has no lookup. `whitelist_uid` is the only action that
 * answers with a player's in-game name, and it bills for it -- so this
 * is a purchase wearing a search icon, not a query. Everything about it
 * is shaped to say so: it is a POST, it writes an ownership row and an
 * audit line exactly like an add, and the button that calls it asks
 * first.
 *
 * One day rather than the validity the operator picked, because the
 * re-issue that follows replaces this entry anyway. That makes the
 * number throwaway and leaves a search nobody followed up as the
 * smallest thing it can be.
 *
 * Callers must check the whitelist they already hold before coming here:
 * a UID on that list carries its verified name for free, and asking the
 * provider again would be both billed and refused.
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

  const db = await loadDb();
  const owner = db.cheatExeWhitelistOwners[uid];
  if (owner && user.role !== "OWNER" && owner !== user.username.toLowerCase()) {
    throw new HttpError(403, "That UID was whitelisted by someone else.");
  }

  const added = await addWhitelist({ uid, region, days: PROBE_DAYS, note: "" });

  await updateDb(async (current, tx) => {
    current.cheatExeWhitelistOwners[uid] = owner ?? user.username.toLowerCase();
    pushAudit(current, {
      user: displayUser(user.username, user.role),
      action: `Verified UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region} -- whitelisted for ${PROBE_DAYS} day`,
      ip,
    });
    await ping("audit", tx);
  });

  return NextResponse.json({ success: true, uid, region, probeDays: PROBE_DAYS, ...added });
});
