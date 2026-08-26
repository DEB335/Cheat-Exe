import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, keysUsedBy, updateDb } from "@/lib/db";
import { keysRemaining, pendingCount } from "@/lib/reseller";
import { callLicenseApi, livePackage, type GenerateResponse } from "@/lib/license-api";
import { packageById } from "@/lib/packages";
import type { KeyRecord } from "@/lib/types";
import { displayUser, formatTimestamp } from "@/lib/utils";

interface GenerateBody {
  packageId?: string;
  duration?: string;
  amount?: string;
}

/**
 * Generates keys through the upstream license API. The API key lives in
 * an env var and is attached here -- it is never sent to the browser.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const body = await readJson<GenerateBody>(request);
  const requested = body.packageId ?? "";
  // Fall back to the live list: a package added upstream is selectable in
  // the generator before it reaches lib/packages.ts, and refusing it here
  // made it look broken rather than new.
  const pkg = packageById(requested) ?? (await livePackage(requested));
  if (!pkg) throw new HttpError(400, "Unknown package.");

  // A reseller may only generate for packages the owner granted them.
  if (user.role !== "OWNER" && !user.packages.includes(pkg.name)) {
    throw new HttpError(403, `You are not allowed to generate keys for ${pkg.name}.`);
  }

  const duration = String(body.duration ?? "30");
  const amount = Number(body.amount ?? 1);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    throw new HttpError(400, "Count must be a whole number between 1 and 100.");
  }

  const isReseller = user.role !== "OWNER";

  // Reserve the allowance BEFORE minting. The reservation is written
  // inside updateDb, whose row lock serialises concurrent requests, so a
  // reseller cannot double-submit from two tabs and slip past the cap:
  // the second request sees the first's reservation. The mint happens
  // outside the lock (it is a slow external call), and the reservation is
  // converted to real history -- or released -- once it returns.
  if (isReseller) {
    await updateDb((db) => {
      const match = findReseller(db, user.username);
      if (!match) return;
      const limit = keysRemaining(match.user, keysUsedBy(db, user.username));
      if (limit === null) return; // uncapped

      const pending = pendingCount(match.user, Date.now());
      const free = Math.max(0, limit - pending);
      if (amount > free) {
        throw new HttpError(
          403,
          free === 0
            ? "You have used your entire key allowance. Ask the owner to raise it."
            : `That would exceed your key allowance -- ${free} left.`,
        );
      }
      match.user.pendingKeys = pending + amount;
      match.user.pendingSince = new Date().toISOString();
    });
  }

  let data: GenerateResponse;
  try {
    data = await callLicenseApi<GenerateResponse>("generate_key", {
      package_id: pkg.id,
      duration,
      amount: String(amount),
    });
  } catch (err) {
    // The mint never happened, so hand the reservation back before
    // surfacing the error.
    if (isReseller) await releaseReservation(user.username, amount);
    throw err;
  }

  if (!data.success) {
    if (isReseller) await releaseReservation(user.username, amount);
    return NextResponse.json({ success: false, raw: data, message: data.message ?? "Generation failed" });
  }

  const generated = data.keys?.length ? data.keys : data.key ? [data.key] : [];
  if (generated.length === 0) {
    if (isReseller) await releaseReservation(user.username, amount);
    return NextResponse.json({ success: true, keys: [], raw: data });
  }

  const creator = user.role === "OWNER" ? "admin" : user.username;
  const records: KeyRecord[] = generated.map((key) => ({
    key,
    package: pkg.name,
    duration,
    creator,
    date: formatTimestamp(),
  }));

  const ip = await clientIp();
  await updateDb((db) => {
    for (const record of records) db.cheatExeKeyHistory.unshift(record);

    // Convert the reservation to recorded history. Release the full
    // amount reserved, not generated.length -- the two match on success,
    // and releasing what was reserved keeps the counter honest even if
    // the upstream returned a different count.
    if (isReseller) {
      const match = findReseller(db, user.username);
      if (match) clearReservation(match.user, amount);
    }

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Generated ${records.length} key(s) for ${pkg.name}`,
      ip,
    });
  });

  return NextResponse.json({ success: true, keys: generated, raw: data });
});

/** Hands a failed request's reserved allowance back. */
async function releaseReservation(username: string, amount: number): Promise<void> {
  await updateDb((db) => {
    const match = findReseller(db, username);
    if (match) clearReservation(match.user, amount);
  });
}

function clearReservation(user: { pendingKeys?: number; pendingSince?: string }, amount: number): void {
  const next = Math.max(0, (user.pendingKeys ?? 0) - amount);
  if (next === 0) {
    delete user.pendingKeys;
    delete user.pendingSince;
  } else {
    user.pendingKeys = next;
  }
}
