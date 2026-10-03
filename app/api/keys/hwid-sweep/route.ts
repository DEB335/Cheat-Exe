import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { HttpError, getSessionUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { hwidSweepToken, sweepUnlockedKeys } from "@/lib/hwid-release";

/** A sweep over many unlocked keys is a few seconds of provider calls. */
export const maxDuration = 60;

/**
 * Frees the device on every unlocked key. See sweepUnlockedKeys.
 *
 * Two callers. An open dashboard tab asks every 20 seconds while there
 * is an unlocked key to look after, under its session -- any role,
 * since the sweep covers every unlocked key whoever made it, and asking
 * for one changes nothing a reseller could not already change. The
 * Supabase cron (scripts/hwid-sweep-cron.sql) keeps it going with every
 * tab closed; it has no cookie, so it sends hwidSweepToken() instead.
 *
 * The answer is the counts and nothing else -- no keys, no names -- so
 * neither caller learns anything about keys that are not theirs.
 */
export const POST = route(async (request: Request) => {
  if (!(await allowed(request))) throw new HttpError(401, "Not authenticated");

  const result = await sweepUnlockedKeys();
  return NextResponse.json({ success: true, ...result });
});

async function allowed(request: Request): Promise<boolean> {
  const sent = request.headers.get("x-hwid-sweep-token");
  if (sent) {
    const expected = hwidSweepToken();
    if (expected && sameString(sent, expected)) return true;
  }
  return (await getSessionUser()) !== null;
}

/**
 * Constant-time comparison. timingSafeEqual refuses buffers of unequal
 * length, and the length of a hex HMAC is no secret, so that is checked
 * first and in the open.
 */
function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
