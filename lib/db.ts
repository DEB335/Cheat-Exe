import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

import type { Database, ProfileSettings, PublicDatabase, Reseller } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

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
 * All reads and writes funnel through this promise chain so two
 * concurrent requests cannot interleave a read-modify-write and clobber
 * each other -- the failure mode the original POST /api/db had.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readRaw(): Promise<Database> {
  try {
    const text = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<Database> & {
      adminPass?: string;
    };

    // Migrate a legacy db.json that still carries a plaintext adminPass.
    let adminPassHash = parsed.adminPassHash;
    if (!adminPassHash) {
      adminPassHash = await bcrypt.hash(parsed.adminPass ?? DEFAULT_ADMIN_PASS, 10);
    }

    return {
      cheatExeUsers: parsed.cheatExeUsers ?? {},
      cheatExeKeyHistory: parsed.cheatExeKeyHistory ?? [],
      cheatExeAuditLogs: parsed.cheatExeAuditLogs ?? [],
      cheatExeDevices: parsed.cheatExeDevices ?? [],
      cheatExeBannedUsers: parsed.cheatExeBannedUsers ?? [],
      adminUser: parsed.adminUser ?? DEFAULT_ADMIN_USER,
      adminPassHash,
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const fresh = emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));
    await writeRaw(fresh);
    return fresh;
  }
}

async function writeRaw(db: Database): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  // Write-then-rename so a crash mid-write cannot truncate the database.
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 4), "utf8");
  await fs.rename(tmp, DB_PATH);
}

export function readDb(): Promise<Database> {
  return serialize(readRaw);
}

/** Read-modify-write under the same lock, so updates never race. */
export function updateDb<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  return serialize(async () => {
    const db = await readRaw();
    const result = await mutate(db);
    await writeRaw(db);
    return result;
  });
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
