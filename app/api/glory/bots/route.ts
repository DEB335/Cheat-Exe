import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUserWithDb } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, updateDb } from "@/lib/db";
import { ping } from "@/lib/realtime";
import type { GloryBotRecord } from "@/lib/types";
import { displayUser, isCreatorMatch } from "@/lib/utils";

interface GenerateBotsBody {
  count: number;
  guildId: string;
  region?: string;
  prefix?: string;
}

/**
 * Credits this reseller has already spent, read from the bot audit trail.
 *
 * The same high-water accounting the emulator bypass uses for keys: the
 * stored counter is a memory, the records are the fact, and the larger of
 * the two wins. Clearing local storage -- where the visible bot list
 * lives -- therefore cannot refund a credit.
 */
function spentFromHistory(db: { cheatExeGloryBots: GloryBotRecord[] }, username: string): number {
  return db.cheatExeGloryBots
    .filter((b) => isCreatorMatch(b.creator, username))
    .reduce((sum, b) => sum + (Number(b.credits) || 0), 0);
}

export const POST = route(async (request: Request) => {
  const { user, db: currentDb } = await requireUserWithDb();
  const body = await readJson<GenerateBotsBody>(request);
  const ip = await clientIp();

  const guild = (body.guildId || "").trim();
  if (!guild) {
    throw new HttpError(400, "Target Guild ID is required.");
  }

  const botCount = Math.min(10, Math.max(1, Number(body.count) || 4));
  // 1 credit per 4 bots (e.g. 1-4 bots = 1 credit, 8 bots = 2 credits)
  const creditsNeeded = Math.ceil(botCount / 4);

  // Permission and credit checks
  if (user.role === "RESELLER") {
    const match = findReseller(currentDb, user.username);
    if (!match) throw new HttpError(404, "Reseller account not found.");

    if (!match.user.guildGloryAccess) {
      throw new HttpError(403, "Guild Glory access is not granted for your account.");
    }

    const limit = match.user.gloryCredits ?? 0;
    if (limit > 0) {
      // Exactly the emulator bypass formula: reconcile the stored
      // high-water mark against the real records before deciding.
      const used = Math.max(
        match.user.gloryCreditsUsed ?? 0,
        spentFromHistory(currentDb, user.username),
      );
      if (used + creditsNeeded > limit) {
        const remaining = Math.max(0, limit - used);
        throw new HttpError(
          400,
          `Insufficient Guild Glory credits. Need ${creditsNeeded} credit(s), but only ${remaining} left.`,
        );
      }
    }
  }

  await updateDb(async (db, tx) => {
    if (user.role === "RESELLER") {
      const match = findReseller(db, user.username);
      if (match) {
        const record: GloryBotRecord = {
          id: `glory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          guildId: guild,
          region: body.region,
          bots: botCount,
          credits: creditsNeeded,
          creator: displayUser(user.username, user.role),
          date: new Date().toISOString(),
        };
        db.cheatExeGloryBots.unshift(record);

        // High-water mark: never below what the records prove was spent.
        const spent = Math.max(
          match.user.gloryCreditsUsed ?? 0,
          spentFromHistory(db, user.username),
        );
        match.user.gloryCreditsUsed = spent;
      }
    }

    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Generated ${botCount} Guild Glory Bots for Guild ${guild} (${creditsNeeded} Credit${creditsNeeded > 1 ? "s" : ""} deducted)`,
      ip,
    });

    await ping("reseller", tx);
  });

  return NextResponse.json({
    success: true,
    count: botCount,
    creditsDeducted: creditsNeeded,
  });
});
