import "server-only";

import bcrypt from "bcryptjs";
import type postgres from "postgres";

import { effectiveStatus } from "./reseller";
import { sql } from "./sql";
import type {
  Database,
  ProfileSettings,
  PublicDatabase,
  Reseller,
  ResellerStatus,
} from "./types";

export const DEFAULT_PROFILE: ProfileSettings = {
  displayName: "Cheat Exe",
  avatar: "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif",
  banner: "https://cdn.imageurlgenerator.com/uploads/696b036b-a046-46e7-a9c0-2616ffe2ddaf.gif",
};

const DEFAULT_ADMIN_USER = process.env.ADMIN_USER ?? "JACK";
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "22153310";

function emptyDb(adminPassHash: string): Database {
  return {
    cheatExeUsers: {},
    cheatExeKeyHistory: [],
    cheatExeAuditLogs: [],
    cheatExeDevices: [],
    cheatExeBannedUsers: [],
    cheatExeBans: [],
    cheatExeMessages: [],
    adminUser: DEFAULT_ADMIN_USER,
    adminPassHash,
    profile: { ...DEFAULT_PROFILE },
  };
}

/**
 * postgres.js types `json()` as an index-signature JSON shape, which a
 * declared interface never satisfies. Database is plain JSON data, so
 * this narrows the type without weakening it anywhere else.
 */
function asJson(value: Database) {
  type JsonArg = Parameters<ReturnType<typeof sql>["json"]>[0];
  return value as unknown as JsonArg;
}

/** Fills in anything a stored document is missing, and migrates legacy shapes. */
async function normalise(stored: Partial<Database> & { adminPass?: string }): Promise<Database> {
  let adminPassHash = stored.adminPassHash;
  if (!adminPassHash) {
    // A document carried over from the old plaintext file store.
    adminPassHash = await bcrypt.hash(stored.adminPass ?? DEFAULT_ADMIN_PASS, 10);
  }

  return {
    cheatExeUsers: stored.cheatExeUsers ?? {},
    cheatExeKeyHistory: stored.cheatExeKeyHistory ?? [],
    cheatExeAuditLogs: stored.cheatExeAuditLogs ?? [],
    cheatExeDevices: stored.cheatExeDevices ?? [],
    cheatExeBannedUsers: stored.cheatExeBannedUsers ?? [],
    cheatExeBans: stored.cheatExeBans ?? [],
    cheatExeMessages: stored.cheatExeMessages ?? [],
    adminUser: stored.adminUser ?? DEFAULT_ADMIN_USER,
    adminPassHash,
    profile: { ...DEFAULT_PROFILE, ...stored.profile },
  };
}

/** Reads the current state, seeding a fresh database on first run. */
export async function readDb(): Promise<Database> {
  const db = sql();
  const rows = await db<{ data: Partial<Database> }[]>`
    select data from app_state where id = 1
  `;

  if (rows.length > 0) return normalise(rows[0]!.data);

  const fresh = emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));
  await db`
    insert into app_state (id, data) values (1, ${db.json(asJson(fresh))})
    on conflict (id) do nothing
  `;
  return fresh;
}

/**
 * Read-modify-write inside a transaction.
 *
 * `for update` locks the row for the life of the transaction, so two
 * requests landing at once queue rather than overwrite each other. This
 * is the part the old file store could not do once the app runs on more
 * than one instance, which is every deployment on Vercel.
 */
/**
 * The transaction handle `updateDb` hands to its callback.
 *
 * Taken from the driver's own namespace rather than inferred from
 * `begin`, which is overloaded -- inference picks the `(options, cb)`
 * form and lands on `string`.
 */
export type Tx = postgres.TransactionSql<Record<string, never>>;

export async function updateDb<T>(
  mutate: (db: Database, tx: Tx) => T | Promise<T>,
): Promise<T> {
  const db = sql();

  return db.begin(async (tx) => {
    const rows = await tx<{ data: Partial<Database> }[]>`
      select data from app_state where id = 1 for update
    `;

    const current =
      rows.length > 0
        ? await normalise(rows[0]!.data)
        : emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));

    const result = await mutate(current, tx);

    await tx`
      insert into app_state (id, data, updated_at)
      values (1, ${tx.json(asJson(current))}, now())
      on conflict (id) do update set data = excluded.data, updated_at = now()
    `;

    return result;
  }) as Promise<T>;
}

/** Strips every password hash before anything reaches the browser. */
export function toPublic(db: Database): PublicDatabase {
  const users: PublicDatabase["cheatExeUsers"] = {};
  for (const [name, user] of Object.entries(db.cheatExeUsers)) {
    const { pass: _pass, ...rest } = user;
    void _pass;
    users[name] = rest;
  }
  return {
    cheatExeUsers: users,
    cheatExeKeyHistory: db.cheatExeKeyHistory,
    cheatExeAuditLogs: db.cheatExeAuditLogs,
    cheatExeDevices: db.cheatExeDevices,
    cheatExeBannedUsers: db.cheatExeBannedUsers,
    cheatExeBans: db.cheatExeBans,
    // Shaped per viewer by the /api/db route, which knows who is asking.
    cheatExeMessages: [],
    adminUser: db.adminUser,
    profile: db.profile,
  };
}

/** Case-insensitive lookup, matching the original login behaviour. */
export function findReseller(
  db: Database,
  username: string,
): { key: string; user: Reseller } | null {
  const lower = username.toLowerCase();
  for (const [key, user] of Object.entries(db.cheatExeUsers)) {
    if (key.toLowerCase() === lower) return { key, user };
  }
  return null;
}

/**
 * Why an account cannot be used right now, or null when it is fine.
 *
 * The login route already refuses a suspended account, but a session
 * opened *before* the suspension stayed valid until its JWT expired.
 * Every authenticated entry point runs this so the block takes effect
 * on the next request rather than twelve hours later.
 */
export function accountBlock(
  db: Database,
  username: string,
  role: "OWNER" | "RESELLER",
): "banned" | "suspended" | "pending" | "expired" | "deleted" | null {
  const isOwnerName = username.toLowerCase() === db.adminUser.toLowerCase();

  const banned = db.cheatExeBannedUsers.some(
    (b) => b.username.toLowerCase() === username.toLowerCase(),
  );
  // The owner cannot lock themselves out of their own panel.
  if (banned && !isOwnerName) return "banned";
  if (role === "OWNER") return null;

  const match = findReseller(db, username);
  if (!match) return "deleted";
  // effectiveStatus, not the stored value: an account whose validity ran
  // out is refused immediately, without waiting for anything to sweep it.
  return statusBlock(effectiveStatus(match.user));
}

export function statusBlock(status: ResellerStatus): "suspended" | "pending" | "expired" | null {
  if (status === "SUSPENDED") return "suspended";
  if (status === "PENDING APPROVAL") return "pending";
  if (status === "EXPIRED") return "expired";
  return null;
}

/**
 * Flips overdue accounts to EXPIRED so the reseller table shows the
 * truth. Bookkeeping only -- access is already decided by
 * effectiveStatus, so nothing depends on this having run.
 */
export function expireOverdue(db: Database): number {
  let changed = 0;
  for (const user of Object.values(db.cheatExeUsers)) {
    const now = effectiveStatus(user);
    if (now === "EXPIRED" && user.status !== "EXPIRED") {
      user.status = "EXPIRED";
      changed += 1;
    }
  }
  return changed;
}

/** Keys this reseller has generated, for the quota check. */
export function keysUsedBy(db: Database, username: string): number {
  const lower = username.toLowerCase();
  return db.cheatExeKeyHistory.filter((k) => k.creator.toLowerCase() === lower).length;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
