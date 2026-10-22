import { NextResponse, after } from "next/server";

import { HttpError, getSessionUser, requireUser } from "@/lib/auth";
import { readJson, route } from "@/lib/api-helpers";
import { editKeyRows } from "@/lib/key-history";
import { getKeyInfo, toKeyInfoView } from "@/lib/license-api";
import { ping } from "@/lib/realtime";

interface Body {
  key?: string;
}

/**
 * Looks a license key up on the upstream API. Read-only -- it records no
 * audit entry, because checking a key is not an action on it.
 */
export const POST = route(async (request: Request) => {
  // The signed cookie first: it costs nothing, and it keeps the lookup
  // below from being started on an anonymous caller's behalf.
  if (!(await getSessionUser())) throw new HttpError(401, "Not authenticated");

  // The account check and the provider lookup side by side. The lookup
  // changes nothing upstream, so starting it early is safe -- and nothing
  // it says leaves this function unless requireUser passes first. The
  // account check is also answered before a bad body is: a suspended
  // account hears that, not "enter a key". The empty catches only mark a
  // failure as seen while something else is awaited; the awaits below
  // still throw it.
  const account = requireUser();
  account.catch(() => {});

  const input = await readJson<Body>(request)
    .then(({ key = "" }) => {
      const trimmed = key.trim();
      if (!trimmed) throw new HttpError(400, "Enter a valid license key first!");
      return trimmed;
    })
    .catch((err: unknown) => err);

  const lookup = typeof input === "string" ? getKeyInfo(input) : null;
  lookup?.catch(() => {});

  await account;
  if (typeof input !== "string" || !lookup) throw input;
  const data = await lookup;

  if (!data.success) {
    return NextResponse.json({
      success: false,
      message: data.message ?? "License key not found.",
    });
  }

  // Mirror the provider's banned/active verdict onto this key's history
  // rows, so Key History's pill agrees with what was just looked up. It
  // is bookkeeping, so it runs after the answer has gone out: the lookup
  // is the thing being waited on, and the write only rings the doorbell
  // when a row actually changed.
  if (data.status) {
    const banned = data.status.toLowerCase() === "banned";
    after(async () => {
      try {
        if (await editKeyRows(input, { banned })) await ping("key");
      } catch (err) {
        console.error("key info: banned flag sync failed", err);
      }
    });
  }

  return NextResponse.json({ success: true, info: toKeyInfoView(data, input) });
});
