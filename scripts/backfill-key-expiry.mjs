/**
 * Fills in the real expiry on keys generated before it was recorded.
 *
 * Key history used to store only the validity typed into the generator,
 * and display it as though it were the key's actual expiry. The upstream
 * discards that number, so a key asked for as 10 days was listed as "10
 * Days" while the provider had issued it as lifetime. New keys read the
 * truth back at generation; this does the same for the old ones.
 *
 *   node scripts/backfill-key-expiry.mjs          # show what would change
 *   node scripts/backfill-key-expiry.mjs --write  # apply it
 *
 * Only ever adds an `expiry` field. Nothing else about a record is
 * touched, no key is created or deleted, and `key_info` is a read.
 */
import fs from "node:fs";
import postgres from "postgres";

const WRITE = process.argv.includes("--write");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const { LICENSE_API_URL, LICENSE_API_KEY, LICENSE_APP_ID, DATABASE_URL } = env;

async function keyInfo(key) {
  const form = new URLSearchParams({
    api_key: LICENSE_API_KEY,
    app_id: LICENSE_APP_ID,
    action: "key_info",
    key,
  });
  const res = await fetch(LICENSE_API_URL, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text.slice(0, 120) };
  }
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 2 });
const rows = await sql`select data from app_state where id = 1`;
const db = rows[0]?.data;
if (!db) {
  console.error("No app_state row found.");
  await sql.end();
  process.exit(1);
}

const history = db.cheatExeKeyHistory ?? [];
const missing = history.filter((k) => !k.expiry);
console.log(`${history.length} keys in history, ${missing.length} without a recorded expiry\n`);

if (missing.length === 0) {
  console.log("Nothing to do.");
  await sql.end();
  process.exit(0);
}

const found = new Map();
for (const record of missing) {
  const info = await keyInfo(record.key);
  if (info.success && info.expiry_date) {
    found.set(record.key, info.expiry_date);
    console.log(
      `  ${record.key}  asked ${String(record.duration).padStart(3)}d  ->  ${info.expiry_date}`,
    );
  } else {
    // A key deleted upstream, or a hiccup. Left alone: the panel shows
    // an unknown validity, which is the honest answer for it.
    console.log(`  ${record.key}  asked ${String(record.duration).padStart(3)}d  ->  (no answer: ${info.message ?? "?"})`);
  }
  // The upstream throttles when pushed; this is a one-off job, so wait.
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\n${found.size} of ${missing.length} resolved.`);

if (!WRITE) {
  console.log("Dry run. Re-run with --write to apply.");
  await sql.end();
  process.exit(0);
}

for (const record of history) {
  const expiry = found.get(record.key);
  if (expiry && !record.expiry) record.expiry = expiry;
}

await sql`
  update app_state
  set data = ${sql.json(db)}, updated_at = now()
  where id = 1
`;
console.log("Written.");

await sql.end();
