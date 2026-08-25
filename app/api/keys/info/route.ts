import { NextResponse } from "next/server";

import { HttpError, requireUser } from "@/lib/auth";
import { readJson, route } from "@/lib/api-helpers";
import { getKeyInfo } from "@/lib/license-api";

interface Body {
  key?: string;
}

/**
 * Looks a license key up on the upstream API. Read-only -- it records no
 * audit entry, because checking a key is not an action on it.
 */
export const POST = route(async (request: Request) => {
  await requireUser();
  const { key = "" } = await readJson<Body>(request);
  const trimmed = key.trim();
  if (!trimmed) throw new HttpError(400, "Enter a valid license key first!");

  const data = await getKeyInfo(trimmed);

  if (!data.success) {
    return NextResponse.json({
      success: false,
      message: data.message ?? "License key not found.",
    });
  }

  return NextResponse.json({
    success: true,
    info: {
      key: data.key ?? trimmed,
      appName: data.app_name ?? "",
      packageName: data.package_name ?? "",
      status: data.status ?? "unknown",
      createdAt: data.created_at ?? "",
      expiryDate: data.expiry_date ?? "",
      hwid: data.hwid ?? "",
      ip: data.ip ?? "",
      durationDays: data.duration_days ?? 0,
    },
  });
});
