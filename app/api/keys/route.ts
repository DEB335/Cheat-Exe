import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateDb } from "@/lib/db";
import { callLicenseApi, type GenerateResponse } from "@/lib/license-api";
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
  const pkg = packageById(body.packageId ?? "");
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

  const data = await callLicenseApi<GenerateResponse>("generate_key", {
    package_id: pkg.id,
    duration,
    amount: String(amount),
  });

  if (!data.success) {
    return NextResponse.json({ success: false, raw: data, message: data.message ?? "Generation failed" });
  }

  const generated = data.keys?.length ? data.keys : data.key ? [data.key] : [];
  if (generated.length === 0) {
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
    pushAudit(db, {
      user: displayUser(user.username, user.role),
      action: `Generated ${records.length} key(s) for ${pkg.name}`,
      ip,
    });
  });

  return NextResponse.json({ success: true, keys: generated, raw: data });
});
