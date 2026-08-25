import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { getStats } from "@/lib/license-api";

/**
 * Real usage counts from the upstream API. The original dashboard
 * derived these from localStorage, which drifts from the truth as soon
 * as a key is issued or revoked anywhere else.
 */
export const GET = route(async () => {
  await requireUser();
  const data = await getStats();

  if (!data.success) {
    return NextResponse.json({ success: false, message: data.message ?? "Stats unavailable" });
  }

  return NextResponse.json({
    success: true,
    stats: {
      username: data.username ?? "",
      totalKeys: data.total_keys ?? 0,
      activeKeys: data.active_keys ?? 0,
      bannedKeys: data.banned_keys ?? 0,
      usedKeys: data.used_keys ?? 0,
      keyLimit: data.key_limit ?? 0,
      keysCreated: data.keys_created ?? 0,
      remaining: data.remaining ?? 0,
    },
  });
});
