import { NextResponse, after } from "next/server";

import { HttpError, clientIp, getSessionUser, requireUserWith } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateSlice } from "@/lib/db";
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
 *   - the entry is removed only if the expiry that comes back is the
 *     one-day expiry this request asked for. A longer one means the add
 *     landed on an entry that already existed;
 *   - and the owner row is claimed, under the row lock, before the
 *     removal. If it has changed at all since this request read it --
 *     even to name this same account -- the UID was whitelisted in the
 *     meantime, and nothing is removed.
 *
 * Speed comes from overlap, never from skipping one of those: the access
 * check (with the owner map, off the same read) and the provider's list
 * are read side by side, and the list is always read fresh for this
 * request -- never the page's few-second cache, since an absence on a
 * stale list is exactly what would aim the probe at a paid entry. The
 * paid write (`whitelist_uid`) still waits for the access check and the
 * owner check to pass.
 */
export const POST = route(async (request: Request) => {
  // Started together. The list only for a request carrying a valid
  // session cookie, so anonymous traffic never reaches the provider, and
  // it is only acted on once the access check below has passed. Marked
  // handled, so a list read that fails while the check refuses the
  // request is not an unhandled rejection.
  const session = await getSessionUser();
  const access = requireUserWith(["cheatExeWhitelistOwners"]);
  const listing = session && !MAINTENANCE ? listWhitelistSnapshot() : null;
  listing?.catch(() => {});

  const { user, db } = await access;
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
  const me = user.username.toLowerCase();
  // What this account's owner rows hold: "owner" for the owner, as the
  // whitelist route writes them, a reseller's lowercased name otherwise.
  const claimAs = user.role === "OWNER" ? "owner" : me;

  // Checked before anything is spent or touched. The provider's list is
  // not filtered by owner, so without this a reseller could read another
  // reseller's customer -- and, worse, reach the probe path for a UID
  // that is not theirs to disturb.
  const owner = db.cheatExeWhitelistOwners[uid];
  const mine = !owner || user.role === "OWNER" || owner === me;
  if (!mine) throw new HttpError(403, "That UID was whitelisted by someone else.");

  // `access` passing means there was a session, so the list was started;
  // the fallback only satisfies the types.
  const snapshot = await (listing ?? listWhitelistSnapshot());
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

  // The provider has been seen to accept an add for a UID it already held
  // and reset the expiry. The expiry coming back is the only evidence of
  // which of those happened, so it is what decides whether to delete.
  const left = daysUntil(added.expireDate);
  const isProbe = left !== null && left <= PROBE_DAYS + 1;

  // Claimed before the removal is attempted, under the row lock, and only
  // if the owner row is still what this request read before paying. If
  // the remove fails, or this request dies between the two calls, the
  // entry that is left is at least attributable -- visible and deletable
  // by whoever made it, rather than an orphan nobody can see or clear.
  //
  // A row that has changed at all in the meantime means the UID was
  // whitelisted while this was in flight -- and the add above may well
  // have landed on that paid entry. That includes a row that appeared
  // naming this same account: a second tab, or ADD pressed mid-search,
  // writes exactly that, and removing would delete the sale just made.
  // Then nothing is claimed and, below, nothing is removed. A failed
  // claim is treated the same way: with the row's state unknown, removing
  // could cut off someone's customer, and a stray one-day entry is the
  // cheaper mistake.
  let claim: "claimed" | "contested" | "failed";
  try {
    claim = await updateSlice(["cheatExeWhitelistOwners"], (current) => {
      const holder = current.cheatExeWhitelistOwners[uid];
      if (holder !== undefined && holder !== owner) return "contested";
      current.cheatExeWhitelistOwners[uid] = claimAs;
      return "claimed";
    });
  } catch (err) {
    console.error("UID check: claim failed", err);
    claim = "failed";
  }

  // The removal stays before the response, deliberately. Moved into
  // `after`, it could land after the reseller -- name now on screen --
  // presses ADD: the real add would be whitelisted first and this remove
  // would then delete the paid entry.
  //
  // Retried only after a thrown error, which says nothing about whether
  // it went through. A definite answer stops it either way: "removed",
  // or a 404 saying the provider no longer holds it -- retrying past
  // that could remove an entry something else re-added in the gap.
  let removal: "removed" | "absent" | "failed" | "skipped" = "skipped";
  if (isProbe && claim === "claimed") {
    removal = "failed";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        removal = (await removeWhitelist(uid)) ? "removed" : "absent";
        break;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  // Off the provider's list either way, so the claim row goes too.
  const gone = removal === "removed" || removal === "absent";
  const named = `UID ${uid}${added.name ? ` (${added.name})` : ""} on ${region}`;
  const action =
    claim === "contested"
      ? `Checked ${named} -- it was whitelisted meanwhile, so it was left untouched`
      : claim === "failed"
        ? `Checked ${named} -- the check could not be recorded, so nothing was removed`
        : !isProbe
        ? `Checked ${named} -- it was already whitelisted and its validity was reset`
        : removal === "removed"
          ? `Checked ${named}`
          : removal === "absent"
            ? `Checked ${named} -- the check entry was already gone`
            : `Checked ${named} -- the ${PROBE_DAYS}-day check entry could not be removed`;

  const finish = () =>
    updateSlice(["cheatExeWhitelistOwners", "cheatExeAuditLogs"], async (current, tx) => {
      // Only the row this request wrote. One that names somebody else by
      // now belongs to a legitimate add made in the meantime.
      if (gone && current.cheatExeWhitelistOwners[uid] === claimAs) {
        delete current.cheatExeWhitelistOwners[uid];
      }
      pushAudit(current, { user: displayUser(user.username, user.role), action, ip });
      await ping("audit", tx);
    });

  if (gone) {
    // The claim row has to be gone before the answer goes out. The page
    // lets the reseller press ADD as soon as the name shows, and that add
    // writes this same owner row; a cleanup still pending in `after`
    // could then land on top of it and delete the paid entry's owner,
    // hiding it from the reseller who sold it. One small write, so the
    // cost is milliseconds.
    //
    // A failure here is logged, not thrown: the credit is spent and the
    // entry is gone either way, and a 500 would only lose the name and
    // send them to pay for it again. What it can leave is a claim row
    // for a UID no longer on the list, which a later add or delete of
    // that UID overwrites or clears.
    try {
      await finish();
    } catch (err) {
      console.error("UID check: cleanup failed", err);
    }
  } else {
    // Nothing to delete -- the row stays either way -- so the audit line
    // is only bookkeeping and goes out after the response.
    after(() => finish().catch((err) => console.error("UID check: audit failed", err)));
  }

  // The name was bought either way, so it is always returned. Throwing
  // here would lose what the credit paid for and still leave the entry.
  return NextResponse.json({
    success: true,
    uid,
    region,
    name: added.name,
    expireDate: added.expireDate,
    alreadyWhitelisted: !isProbe || claim === "contested",
    // The next two describe a row this account now owns, so they are only
    // set when the claim went through. Without it there is no owner row:
    // a reseller could neither see nor delete the entry, and ADD would
    // take the re-issue path and be refused.
    /** True when this request's check entry is still on the provider's list. */
    strayEntry: claim === "claimed" && isProbe && !gone,
    /** True when the add landed on an entry that already existed. */
    resetExisting: claim === "claimed" && !isProbe,
    /** True when the UID was whitelisted while this was in flight. */
    contested: claim === "contested",
    /** True when the check could not be recorded, so its entry may remain. */
    claimFailed: claim === "failed",
  });
});
