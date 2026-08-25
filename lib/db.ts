import "server-only";

import bcrypt from "bcryptjs";

import { sql } from "./sql";
import type { Database, ProfileSettings, PublicDatabase, Reseller } from "./types";

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
export async function updateDb<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  const db = sql();

  return db.begin(async (tx) => {
    const rows = await tx<{ data: Partial<Database> }[]>`
      select data from app_state where id = 1 for update
    `;

    const current =
      rows.length > 0
        ? await normalise(rows[0]!.data)
        : emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));

    const result = await mutate(current);

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

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
