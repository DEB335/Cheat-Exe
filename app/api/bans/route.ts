import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { BAN_SCOPE_LABEL, addBan, dropBannedSessions, removeBan } from "@/lib/bans";
import { updateDb } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { ping } from "@/lib/realtime";
import { formatTimestamp } from "@/lib/utils";
import type { BanScope } from "@/lib/types";

const SCOPES: BanScope[] = ["ip", "hwid", "fingerprint"];

interface BanEntry {
  scope?: BanScope;
  value?: string;
}

interface PostBody {
  /** One or more rules, so "block this device" can write hwid + signature together. */
  rules?: BanEntry[];
  reason?: string;
  /** Account the block was raised from, recorded for the vault listing. */
  user?: string;
}

/**
 * Device-level blocks. These sit in front of the password check, so a
 * blocked address or machine cannot reach any account at all -- unlike
 * suspending a reseller, which only closes that one account.
 */
export const POST = route(async (request: Request) => {
  const owner = await requireOwner();
  const body = await readJson<PostBody>(request);
  const ip = await clientIp();

  const rules = (body.rules ?? []).filter(
    (r): r is { scope: BanScope; value: string } =>
      !!r.scope && SCOPES.includes(r.scope) && typeof r.value === "string" && r.value.length > 0,
  );
  if (rules.length === 0) throw new HttpError(400, "Nothing to block.");

  // Refuse to lock the owner out of their own panel from their own seat.
  const self = await deviceIdentity();
  const selfMarks: Record<BanScope, string> = {
    ip,
    hwid: self.hwid,
    fingerprint: self.fingerprint,
  };
  for (const rule of rules) {
    if (selfMarks[rule.scope].toLowerCase() === rule.value.toLowerCase()) {
      throw new HttpError(400, `That ${BAN_SCOPE_LABEL[rule.scope]} is your own. Blocked nothing.`);
    }
  }

  const added = await updateDb(async (db, tx) => {
    let count = 0;
    for (const rule of rules) {
      const ok = addBan(db, {
        scope: rule.scope,
        value: rule.value,
        reason: body.reason?.trim() || "Blocked by owner",
        by: owner.username,
        at: formatTimestamp(),
        user: body.user,
      });
      if (ok) count += 1;
    }

    if (count > 0) {
      dropBannedSessions(db, owner.sessionId);
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Blocked ${rules.map((r) => `${BAN_SCOPE_LABEL[r.scope]} ${r.value}`).join(", ")}`,
        ip,
      });
      await ping("ban", tx);
    }

    return count;
  });

  return NextResponse.json({ success: true, added });
});

/** DELETE /api/bans?scope=ip&value=1.2.3.4 -- lift one rule. */
export const DELETE = route(async (request: Request) => {
  await requireOwner();
  const ip = await clientIp();

  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") as BanScope | null;
  const value = params.get("value");
  if (!scope || !SCOPES.includes(scope) || !value) {
    throw new HttpError(400, "Provide a scope and a value.");
  }

  const removed = await updateDb(async (db, tx) => {
    const ok = removeBan(db, scope, value);
    if (ok) {
      pushAudit(db, {
        user: "Owner (OWNER)",
        action: `Lifted block on ${BAN_SCOPE_LABEL[scope]} ${value}`,
        ip,
      });
      await ping("ban", tx);
    }
    return ok;
  });

  if (!removed) throw new HttpError(404, "No such block.");
  return NextResponse.json({ success: true });
});
