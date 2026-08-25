import { NextResponse } from "next/server";

import { HttpError, clientIp, requireOwner } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { findReseller, hashPassword, updateDb } from "@/lib/db";
import { PACKAGE_NAMES } from "@/lib/packages";
import { formatDateOnly } from "@/lib/utils";

interface CreateBody {
  username?: string;
  password?: string;
  packages?: string[];
}

export const POST = route(async (request: Request) => {
  await requireOwner();
  const body = await readJson<CreateBody>(request);

  const username = (body.username ?? "").trim();
  const password = (body.password ?? "").trim();

  if (!username || !password) throw new HttpError(400, "Enter username and password!");
  if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters.");

  const packages = (body.packages ?? []).filter((p) => PACKAGE_NAMES.includes(p));
  const hash = await hashPassword(password);
  const ip = await clientIp();

  await updateDb((db) => {
    if (findReseller(db, username)) throw new HttpError(409, "User already exists!");
    db.cheatExeUsers[username] = {
      pass: hash,
      status: "PENDING APPROVAL",
      created: formatDateOnly(),
      packages,
    };
    pushAudit(db, {
      user: "Owner (OWNER)",
      action: `Created reseller account: ${username}`,
      ip,
    });
  });

  return NextResponse.json({ success: true });
});
