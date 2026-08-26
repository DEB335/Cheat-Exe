/**
 * Moves this app's data to a Supabase project in another region.
 *
 * Supabase fixes a project's region at creation, so "moving to Mumbai"
 * really means: create a new project there, copy the data across, and
 * repoint the app. This script is the copy step.
 *
 * The whole app is one JSONB row plus a disposable ping table, so the
 * copy is a few kilobytes and takes seconds. The old project is left
 * untouched -- nothing is deleted -- so a bad switch is reversible by
 * putting the old connection string back.
 *
 *   node scripts/migrate-region.mjs
 *
 * Reads OLD_DATABASE_URL and NEW_DATABASE_URL from the environment.
 * Pass --force to overwrite data that already exists in the target.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const OLD = process.env.OLD_DATABASE_URL;
const NEW = process.env.NEW_DATABASE_URL;
const FORCE = process.argv.includes("--force");

if (!OLD || !NEW) {
  console.error("Set OLD_DATABASE_URL and NEW_DATABASE_URL first.");
  process.exit(1);
}
if (OLD === NEW) {
  console.error("Both URLs point at the same project. Nothing to do.");
  process.exit(1);
}

const connect = (url) => postgres(url, { prepare: false, max: 1, connect_timeout: 20 });
const old = connect(OLD);
const next = connect(NEW);

const region = (url) => url.match(/aws-\d-([a-z0-9-]+)\.pooler/)?.[1] ?? "unknown";
console.log(`from: ${region(OLD)}\n  to: ${region(NEW)}\n`);

try {
  // 1. Schema on the target, exactly as source control describes it.
  const schema = fs.readFileSync(path.join(process.cwd(), "scripts", "schema.sql"), "utf8");
  console.log("applying schema...");
  await next.unsafe(schema).simple();
  console.log("  schema ok");

  // 2. The data itself.
  const rows = await old`select data from app_state where id = 1`;
  if (rows.length === 0) {
    console.error("Source has no app_state row. Refusing to migrate nothing.");
    process.exit(1);
  }
  const data = rows[0].data;

  const existing = await next`select data from app_state where id = 1`;
  const populated = existing.length > 0 && Object.keys(existing[0].data ?? {}).length > 3;
  if (populated && !FORCE) {
    console.error("Target already holds data. Re-run with --force to overwrite it.");
    process.exit(1);
  }

  console.log("copying app_state...");
  await next`
    insert into app_state (id, data, updated_at) values (1, ${next.json(data)}, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;

  // 3. Prove it landed. Comparing counts beats trusting the write.
  const [check] = await next`select data from app_state where id = 1`;
  const count = (d, k) => (Array.isArray(d?.[k]) ? d[k].length : Object.keys(d?.[k] ?? {}).length);
  const fields = [
    "cheatExeUsers",
    "cheatExeKeyHistory",
    "cheatExeAuditLogs",
    "cheatExeDevices",
    "cheatExeBannedUsers",
    "cheatExeBans",
    "cheatExeMessages",
  ];

  let ok = true;
  console.log("\nverifying:");
  for (const f of fields) {
    const a = count(data, f);
    const b = count(check.data, f);
    const same = a === b;
    if (!same) ok = false;
    console.log(`  ${same ? "ok  " : "FAIL"} ${f.padEnd(22)} ${a} -> ${b}`);
  }
  const sameAdmin = data.adminUser === check.data.adminUser;
  const sameHash = data.adminPassHash === check.data.adminPassHash;
  if (!sameAdmin || !sameHash) ok = false;
  console.log(`  ${sameAdmin ? "ok  " : "FAIL"} owner username`);
  console.log(`  ${sameHash ? "ok  " : "FAIL"} owner password hash`);

  console.log(ok ? "\nMigration complete." : "\nMigration FAILED verification.");
  process.exit(ok ? 0 : 1);
} finally {
  await old.end();
  await next.end();
}
