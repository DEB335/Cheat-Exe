import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api-helpers";
import { getPackages } from "@/lib/license-api";
import { PACKAGES } from "@/lib/packages";
import type { LicensePackage } from "@/lib/types";

/**
 * Live package list, so a package added upstream shows up without a
 * redeploy. Falls back to the compiled-in list if the API is down, which
 * keeps the generator usable rather than empty.
 */
export const GET = route(async () => {
  await requireUser();

  try {
    const data = await getPackages();
    if (data.success && data.packages?.length) {
      const packages: LicensePackage[] = data.packages.map((p) => ({
        id: p.package_id,
        name: p.package_name,
        // The API has no blurb field, so keep the original wording for
        // packages we already know and derive one only for new arrivals.
        description:
          PACKAGES.find((known) => known.id === p.package_id)?.description ??
          `${p.package_name} Package`,
      }));
      return NextResponse.json({ success: true, packages, source: "api" });
    }
  } catch {
    /* fall through to the bundled list */
  }

  return NextResponse.json({ success: true, packages: PACKAGES, source: "fallback" });
});
