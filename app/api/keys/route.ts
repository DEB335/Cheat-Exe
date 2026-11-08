import { NextResponse, after } from "next/server";

import { HttpError, clientIp, getSessionUser, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { countKeysBy, findReseller, updateDb, updateSlice, type SlicedField } from "@/lib/db";
import { keysRemaining, pendingCount } from "@/lib/reseller";
import { callLicenseApi, getKeyInfo, livePackage, type GenerateResponse } from "@/lib/license-api";
import { packageById } from "@/lib/packages";
import { ping } from "@/lib/realtime";
import type { KeyRecord } from "@/lib/types";
import { displayUser, formatTimestamp } from "@/lib/utils";

interface GenerateBody {
  packageId?: string;
  duration?: string;
  amount?: string;
  /**
   * Whether the keys stay on the first device that uses them. Anything
   * but an explicit `false` means locked, which is also what a key minted
   * before the switch existed is.
   */
  hwidLock?: boolean;
}

/** A generate request's body, checked. */
interface GenerateInput {
  requested: string;
  duration: string;
  amount: number;
  hwidLock: boolean;
}

function parseGenerate(body: GenerateBody): GenerateInput {
  // A whole number of days, 0 for lifetime. Checked here because the
  // provider mints first and the reseller's allowance pays for whatever
  // it made of a stray "-3" or "7.5".
  const duration = String(body.duration ?? "30").trim() || "30";
  if (!/^\d{1,5}$/.test(duration)) {
    throw new HttpError(400, "Days must be a whole number (0 for lifetime).");
  }
  const amount = Number(body.amount ?? 1);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    throw new HttpError(400, "Count must be a whole number between 1 and 100.");
  }

  return {
    requested: body.packageId ?? "",
    duration,
    amount,
    // Not sent to the provider: it has no such parameter and binds every
    // key regardless. The panel records the choice, and the sweep
    // (lib/hwid-release.ts) keeps an unlocked key's device free.
    hwidLock: body.hwidLock !== false,
  };
}

/**
 * Generates keys through the upstream license API. The API key lives in
 * an env var and is attached here -- it is never sent to the browser.
 */
export const POST = route(async (request: Request) => {
  // A signed cookie, checked before anything else is started: the
  // package lookup below goes out before the full account check has
  // answered, and it should never go out for an anonymous caller.
  if (!(await getSessionUser())) throw new HttpError(401, "Not authenticated");

  // The account check, the body and the package lookup side by side:
  // none needs the others, and one after the other they were separate
  // round trips on every click. The account check is still answered
  // first -- a suspended or deleted account hears that, not a complaint
  // about its form -- so a bad body is held, not thrown, until it has.
  // The empty catch marks a refusal as seen while the body is read; the
  // await below still throws it.
  const account = requireUser();
  account.catch(() => {});
  const input = await readJson<GenerateBody>(request)
    .then(parseGenerate)
    .catch((err: unknown) => err);

  // Known packages resolve instantly from the bundled list; only an id it
  // does not know waits on the live one. That lookup starts here, beside
  // the account check, rather than after it. livePackage never throws (it
  // answers null on any failure), so it cannot be left unhandled by a
  // refusal above.
  const bundled = input instanceof Error ? undefined : packageById((input as GenerateInput).requested);
  const live =
    input instanceof Error || bundled ? null : livePackage((input as GenerateInput).requested);

  const user = await account;
  if (input instanceof Error) throw input;
  const { duration, amount, hwidLock } = input as GenerateInput;

  const pkg = bundled ?? (await live);
  if (!pkg) throw new HttpError(400, "Unknown package.");

  const isReseller = user.role !== "OWNER";

  // Reserve the allowance BEFORE minting. The reservation is written
  // inside updateSlice, whose row lock serialises concurrent requests, so
  // a reseller cannot double-submit from two tabs and slip past the cap:
  // the second request sees the first's reservation. The mint happens
  // outside the lock (it is a slow external call), and the reservation is
  // converted to real history -- or released -- once it returns.
  //
  // Only the reseller records are read and written. The keys already
  // used are counted in Postgres under the same lock, so the history --
  // most of the document -- never leaves the database for a quota check.
  if (isReseller) {
    await updateSlice(["cheatExeUsers"], async (db, tx) => {
      const match = findReseller(db, user.username);
      if (!match) throw new HttpError(403, "This account no longer exists.");

      // A reseller may only generate for packages the owner granted them,
      // read from the record rather than from `user.packages`. That field
      // is a copy frozen into the session token at login, so trusting it
      // left a revoked package usable for the rest of the twelve-hour
      // token and refused a freshly granted one until the next sign-in.
      // The row lock this runs under also means a revocation landing
      // mid-request is seen, not raced past.
      if (!match.user.packages.includes(pkg.name)) {
        throw new HttpError(403, `You are not allowed to generate keys for ${pkg.name}.`);
      }

      // Uncapped accounts skip the count altogether.
      if (keysRemaining(match.user, 0) === null) return;
      const limit = keysRemaining(match.user, await countKeysBy(tx, user.username)) ?? 0;

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
      // The provider names these `days` and `count`. This panel inherited
      // `duration` and `amount` from the one it replaced, and neither is
      // read: `count` is what actually sets the quantity, so asking for
      // ten keys minted exactly one, every time, without complaint. Both
      // go as integers, as the provider's client sends them: the body is
      // JSON now, where "30" and 30 are no longer the same thing.
      days: Number(duration),
      count: amount,
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

  // The provider's own client reads `data.keys`; the top-level spelling
  // is kept for the host this panel was built against. Missing both is
  // not "no keys" -- the mint succeeded -- so it must not go unnoticed.
  const nested = data.data?.keys?.length ? data.data.keys : data.data?.key ? [data.data.key] : [];
  const generated = nested.length
    ? nested
    : data.keys?.length
      ? data.keys
      : data.key
        ? [data.key]
        : [];
  if (generated.length === 0) {
    if (isReseller) await releaseReservation(user.username, amount);
    return NextResponse.json({ success: true, keys: [], raw: data, hwidLock });
  }

  const creator = user.role === "OWNER" ? "admin" : user.username;
  // `appliedDays` records that this key was minted through a request the
  // provider honours, which is what makes the number worth showing later.
  // A non-numeric box is possible, and an unusable number should not be
  // recorded as though the provider had applied it.
  const asked = Number(duration);
  const applied = Number.isFinite(asked) && asked >= 0 ? asked : undefined;

  const records: KeyRecord[] = generated.map((key) => ({
    key,
    package: pkg.name,
    duration,
    ...(applied === undefined ? {} : { appliedDays: applied }),
    // Stored either way, so a new key never leans on "absent means
    // locked" -- that reading exists only for keys older than the switch.
    hwidLock,
    creator,
    date: formatTimestamp(),
  }));

  const ip = await clientIp();

  // One transaction and one UPDATE, and only the small fields cross the
  // wire: the new records go on top of the history inside Postgres, in
  // the same statement that merges the slice back, so recording a mint no
  // longer pulls the whole history down and writes every byte of it back.
  // The reseller records come along only when there is a reservation to
  // convert.
  const fields: Extract<SlicedField, "cheatExeAuditLogs" | "cheatExeUsers">[] = isReseller
    ? ["cheatExeAuditLogs", "cheatExeUsers"]
    : ["cheatExeAuditLogs"];
  await updateSlice(
    fields,
    async (db, tx) => {
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
        action: `Generated ${records.length} key(s) for ${pkg.name}${hwidLock ? "" : " (HWID unlocked)"}`,
        ip,
      });

      // `generated.length === 0` returned above, so reaching here always
      // added history and (for a reseller) moved their quota.
      await ping("key", tx);
    },
    { prepend: records },
  );

  recordRealExpiry(generated);

  return NextResponse.json({
    success: true,
    keys: generated,
    raw: data,
    hwidLock,
    // The rows exactly as they now sit at the top of the history, newest
    // first, so the page can show them in Key History (and count them
    // against a reseller's allowance) without waiting for a re-read.
    history: [...records].reverse(),
  });
});

/**
 * Records a real expiry date against these keys, if the provider will
 * give one.
 *
 * It usually will not: `key_info` answers `"Never (Lifetime)"` for every
 * unused key regardless of the validity actually applied, contradicting
 * the provider's own portal. Storing that would be storing a wrong
 * answer, so only a genuine date is kept -- which makes this a no-op
 * today and the thing that fills the column in by itself if they ever
 * fix it.
 *
 * It runs in `after`, once the response has already gone out, so the
 * round trip costs generation nothing. One lookup covers the whole batch
 * -- they came from a single call with identical parameters, so they
 * cannot differ from each other.
 */
function recordRealExpiry(keys: string[]): void {
  after(async () => {
    let expiry: string | undefined;
    try {
      expiry = (await getKeyInfo(keys[0])).expiry_date;
    } catch {
      /* the keys are real either way; history just will not claim an expiry */
    }
    if (!expiry || /lifetime|never/i.test(expiry)) return;

    const minted = new Set(keys);
    await updateDb(async (db, tx) => {
      let changed = false;
      for (const record of db.cheatExeKeyHistory) {
        if (!minted.has(record.key) || record.expiry === expiry) continue;
        record.expiry = expiry;
        changed = true;
      }
      // Only ring the doorbell if a row actually moved.
      if (changed) await ping("key", tx);
    });
  });
}

/** Hands a failed request's reserved allowance back. */
async function releaseReservation(username: string, amount: number): Promise<void> {
  await updateSlice(["cheatExeUsers"], (db) => {
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
