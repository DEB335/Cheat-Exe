/**
 * Copies the local database into Supabase.
 *
 * Source order: data/db.json (already hashed) if present, otherwise the
 * legacy old/db.json (plaintext passwords, hashed on the way in).
 * Refuses to overwrite existing remote data unless --force is passed.
 *
 *   node --env-file=.env.local scripts/migrate.mjs [--force]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const force = process.argv.includes("--force");
const root = process.cwd();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/migrate.mjs");
  process.exit(1);
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

const local = await readJson(path.join(root, "data", "db.json"));
const legacy = await readJson(path.join(root, "old", "db.json"));
const source = local ?? legacy;
const sourceName = local ? "data/db.json" : legacy ? "old/db.json" : null;

if (!source) {
  console.error("Nothing to migrate: neither data/db.json nor old/db.json was found.");
  process.exit(1);
}
console.log(`Source: ${sourceName}`);

// Hash anything still in plaintext.
const adminPassHash =
  source.adminPassHash ?? (await bcrypt.hash(source.adminPass ?? "22153310", 10));

const users = {};
for (const [name, value] of Object.entries(source.cheatExeUsers ?? {})) {
  const alreadyHashed = typeof value === "object" && /^\$2[aby]\$/.test(value.pass ?? "");
  const plain = typeof value === "string" ? value : value.pass;
  users[name] = {
    pass: alreadyHashed ? value.pass : await bcrypt.hash(plain ?? "", 10),
    status: typeof value === "string" ? "ACTIVE" : (value.status ?? "PENDING APPROVAL"),
    created: typeof value === "string" ? "" : (value.created ?? ""),
    packages: typeof value === "string" ? [] : (value.packages ?? []),
  };
}

const payload = {
  cheatExeUsers: users,
  cheatExeKeyHistory: source.cheatExeKeyHistory ?? [],
  cheatExeAuditLogs: source.cheatExeAuditLogs ?? [],
  // Sessions do not survive the move -- their cookies were signed for the old host.
  cheatExeDevices: [],
  cheatExeBannedUsers: (source.cheatExeBannedUsers ?? []).map((b) => ({ ...b, password: "" })),
  adminUser: source.adminUser ?? "JACK",
  adminPassHash,
  profile: source.profile ?? {
    displayName: "Cheat Exe",
    avatar: "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif",
    banner: "https://cdn.imageurlgenerator.com/uploads/696b036b-a046-46e7-a9c0-2616ffe2ddaf.gif",
  },
};

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 20 });

try {
  const existing = await sql`select data from app_state where id = 1`;
  if (existing.length > 0 && !force) {
    const d = existing[0].data;
    console.log("\nSupabase already holds data:");
    console.log(`  owner:      ${d.adminUser}`);
    console.log(`  resellers:  ${Object.keys(d.cheatExeUsers ?? {}).length}`);
    console.log(`  keys:       ${(d.cheatExeKeyHistory ?? []).length}`);
    console.log(`  audit logs: ${(d.cheatExeAuditLogs ?? []).length}`);
    console.log("\nRefusing to overwrite. Re-run with --force if that is what you want.");
    await sql.end();
    process.exit(0);
  }

  await sql`
    insert into app_state (id, data, updated_at)
    values (1, ${sql.json(payload)}, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;

  const [check] = await sql`select data, updated_at from app_state where id = 1`;
  console.log("\nMigrated to Supabase:");
  console.log(`  owner:      ${check.data.adminUser}`);
  console.log(`  resellers:  ${Object.keys(check.data.cheatExeUsers).length}`);
  console.log(`  keys:       ${check.data.cheatExeKeyHistory.length}`);
  console.log(`  audit logs: ${check.data.cheatExeAuditLogs.length}`);
  console.log(`  updated_at: ${check.updated_at.toISOString()}`);
} finally {
  await sql.end();
}
