/**
 * Migrates the legacy old/db.json into data/db.json, replacing the
 * plaintext adminPass with a bcrypt hash. Safe to re-run: it refuses to
 * overwrite an existing data/db.json unless --force is passed.
 *
 *   node scripts/seed.mjs [--force]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const root = process.cwd();
const source = path.join(root, "old", "db.json");
const target = path.join(root, "data", "db.json");
const force = process.argv.includes("--force");

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

if ((await exists(target)) && !force) {
  console.log(`data/db.json already exists. Re-run with --force to overwrite.`);
  process.exit(0);
}

let legacy = {};
if (await exists(source)) {
  legacy = JSON.parse(await fs.readFile(source, "utf8"));
  console.log("Reading old/db.json ...");
} else {
  console.log("old/db.json not found -- writing an empty database.");
}

const adminPass = process.env.ADMIN_PASSWORD ?? legacy.adminPass ?? "22153310";
const adminPassHash = await bcrypt.hash(adminPass, 10);

// Reseller passwords were stored in plaintext too; hash whatever is there.
const users = {};
for (const [name, value] of Object.entries(legacy.cheatExeUsers ?? {})) {
  const plain = typeof value === "string" ? value : value.pass;
  users[name] = {
    pass: await bcrypt.hash(plain ?? "", 10),
    status: typeof value === "string" ? "ACTIVE" : (value.status ?? "PENDING APPROVAL"),
    created: typeof value === "string" ? "" : (value.created ?? ""),
    packages: typeof value === "string" ? [] : (value.packages ?? []),
  };
}

// Vault records no longer carry recoverable passwords.
const banned = (legacy.cheatExeBannedUsers ?? []).map((record) => ({
  ...record,
  password: "",
}));

const db = {
  cheatExeUsers: users,
  cheatExeKeyHistory: legacy.cheatExeKeyHistory ?? [],
  cheatExeAuditLogs: legacy.cheatExeAuditLogs ?? [],
  // Old sessions cannot be honoured -- their cookies were never signed.
  cheatExeDevices: [],
  cheatExeBannedUsers: banned,
  adminUser: legacy.adminUser ?? process.env.ADMIN_USER ?? "JACK",
  adminPassHash,
  profile: {
    displayName: "Cheat Exe",
    avatar: "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif",
    banner: "https://cdn.imageurlgenerator.com/uploads/696b036b-a046-46e7-a9c0-2616ffe2ddaf.gif",
  },
};

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, JSON.stringify(db, null, 4), "utf8");

console.log(`Wrote data/db.json`);
console.log(`  owner:      ${db.adminUser}`);
console.log(`  resellers:  ${Object.keys(users).length}`);
console.log(`  keys:       ${db.cheatExeKeyHistory.length}`);
console.log(`  audit logs: ${db.cheatExeAuditLogs.length}`);
console.log(`\nOwner password is the one from old/db.json (or ADMIN_PASSWORD). Change it after signing in.`);
