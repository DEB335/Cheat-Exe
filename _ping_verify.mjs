/**
 * Throwaway verification script for the realtime-ping task.
 *
 * Signs in as the owner over HTTP with a cookie jar, drives each mutating
 * route, and confirms a fresh row lands in `realtime_pings` for it. Also
 * spot-checks that no-op mutations (and login/logout) do NOT ping.
 *
 * Snapshots app_state.data before touching anything and restores it
 * byte-for-byte at the end, so destructive routes (clear audit log, clear
 * banned vault, clear key history) can be exercised safely. Never touches
 * the real resellers "1", "12", "22", "aa", and never calls the key
 * generation endpoint (costs real money) -- that one is verified by code
 * inspection only, noted at the bottom.
 *
 * Delete this file when done: `rm _ping_verify.mjs`.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

// ---- env -------------------------------------------------------------
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = "http://localhost:3100";
const TEST_USER = "zzpingcheck";
const PROTECTED = new Set(["1", "12", "22", "aa"]);
if (PROTECTED.has(TEST_USER.toLowerCase())) throw new Error("test username collides with a real reseller");

const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

let pass = 0;
let fail = 0;
const results = [];
function report(label, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -- " + detail : ""}`);
}

// ---- tiny cookie jar ---------------------------------------------------
function makeJar() {
  const cookies = new Map();
  return {
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const raw of set) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    },
  };
}

async function call(jar, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar.header() ? { Cookie: jar.header() } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  jar.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

// ---- ping bookkeeping --------------------------------------------------
async function maxPingId() {
  const rows = await sql`select coalesce(max(id), 0) as id from realtime_pings`;
  return Number(rows[0].id);
}

/** Runs `fn`, then checks whether a ping of `kind` landed after `before`. */
async function expectPing(label, kind, before, fn) {
  const { status, json } = await fn();
  await new Promise((r) => setTimeout(r, 150)); // let the insert commit/settle
  const rows = await sql`select kind from realtime_pings where id > ${before} order by id`;
  const got = rows.map((r) => r.kind);
  const ok = got.includes(kind);
  report(label, ok, ok ? "" : `status=${status} kinds seen=[${got.join(",")}] body=${JSON.stringify(json).slice(0, 150)}`);
  return await maxPingId();
}

/** Runs `fn` and asserts NO ping landed at all. */
async function expectNoPing(label, before, fn) {
  const { status } = await fn();
  await new Promise((r) => setTimeout(r, 150));
  const rows = await sql`select kind from realtime_pings where id > ${before} order by id`;
  const ok = rows.length === 0;
  report(label, ok, ok ? "" : `unexpected ping(s): [${rows.map((r) => r.kind).join(",")}] status=${status}`);
  return await maxPingId();
}

// =========================================================================
console.log("\n### snapshot ###");
const before = await sql`select data from app_state where id = 1`;
const snapshot = before[0].data;
report("captured app_state snapshot", !!snapshot);

let cursor = await maxPingId();

const owner = makeJar();
const loginRes = await call(owner, "POST", "/api/auth/login", {
  username: env.ADMIN_USER,
  password: env.ADMIN_PASSWORD,
});
report("owner login succeeds", loginRes.status === 200, JSON.stringify(loginRes.json).slice(0, 150));
// Login itself must NOT ping -- see reasoning in app/api/auth/login/route.ts.
cursor = await expectNoPing("login does not ping", cursor, async () => loginRes);

try {
  // ---- profile (ping "profile") ----------------------------------------
  console.log("\n### profile ###");
  cursor = await expectPing("PATCH /api/profile pings 'profile'", "profile", cursor, () =>
    call(owner, "PATCH", "/api/profile", {
      username: env.ADMIN_USER,
      password: env.ADMIN_PASSWORD,
      displayName: snapshot.profile.displayName, // unchanged value, still a real write
      avatar: snapshot.profile.avatar,
      banner: snapshot.profile.banner,
    }),
  );

  // ---- resellers (ping "reseller") --------------------------------------
  console.log("\n### resellers ###");
  await call(owner, "DELETE", `/api/resellers/${TEST_USER}`); // clean slate, ignore result
  cursor = await maxPingId();

  cursor = await expectPing("POST /api/resellers (create) pings 'reseller'", "reseller", cursor, () =>
    call(owner, "POST", "/api/resellers", {
      username: TEST_USER,
      password: "ping-test-pass",
      packages: [],
      validityDays: 30,
      keyLimit: 10,
      deviceLocked: false,
    }),
  );

  cursor = await expectPing("PATCH status pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { status: "ACTIVE" }),
  );
  cursor = await expectPing("PATCH packages pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { packages: [] }),
  );
  cursor = await expectPing("PATCH password pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { password: "ping-test-pass-2" }),
  );
  cursor = await expectPing("PATCH validityDays pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { validityDays: 45 }),
  );
  cursor = await expectPing("PATCH keyLimit pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { keyLimit: 20 }),
  );
  cursor = await expectPing("PATCH deviceLocked pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { deviceLocked: true }),
  );
  cursor = await expectPing("PATCH resetLock pings 'reseller'", "reseller", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { resetLock: true }),
  );
  cursor = await expectNoPing("PATCH with no recognised fields does NOT ping", cursor, () =>
    call(owner, "PATCH", `/api/resellers/${TEST_USER}`, {}),
  );
  cursor = await expectNoPing("PATCH on unknown username does NOT ping", cursor, () =>
    call(owner, "PATCH", `/api/resellers/does-not-exist-zz`, { status: "ACTIVE" }),
  );

  // disable device lock so repeated logins below don't get refused
  await call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { deviceLocked: false });
  cursor = await maxPingId();

  // ---- bans (ping "ban") -------------------------------------------------
  console.log("\n### bans (block rules) ###");
  const TEST_IP = "203.0.113.77"; // TEST-NET-3, RFC 5737 -- never a real address
  await call(owner, "DELETE", `/api/bans?scope=ip&value=${TEST_IP}`); // clean slate
  cursor = await maxPingId();

  cursor = await expectPing("POST /api/bans pings 'ban'", "ban", cursor, () =>
    call(owner, "POST", "/api/bans", { rules: [{ scope: "ip", value: TEST_IP }], reason: "ping test" }),
  );
  cursor = await expectPing("DELETE /api/bans pings 'ban'", "ban", cursor, () =>
    call(owner, "DELETE", `/api/bans?scope=ip&value=${TEST_IP}`),
  );
  cursor = await expectNoPing("DELETE /api/bans on missing rule does NOT ping", cursor, () =>
    call(owner, "DELETE", `/api/bans?scope=ip&value=${TEST_IP}`),
  );

  // ---- devices (ping "device") -------------------------------------------
  console.log("\n### devices ###");
  const reseller = makeJar();
  const rLogin1 = await call(reseller, "POST", "/api/auth/login", {
    username: TEST_USER,
    password: "ping-test-pass-2",
  });
  report("test reseller login succeeds (session 1)", rLogin1.status === 200, JSON.stringify(rLogin1.json).slice(0, 150));
  cursor = await expectNoPing("reseller login does not ping", cursor, async () => rLogin1);

  cursor = await expectPing("DELETE /api/devices (clear sessions) pings 'device'", "device", cursor, () =>
    call(owner, "DELETE", "/api/devices"),
  );
  cursor = await expectNoPing("DELETE /api/devices with nothing else logged in does NOT ping", cursor, () =>
    call(owner, "DELETE", "/api/devices"),
  );

  const rLogin2 = await call(reseller, "POST", "/api/auth/login", {
    username: TEST_USER,
    password: "ping-test-pass-2",
  });
  report("test reseller login succeeds (session 2)", rLogin2.status === 200);
  cursor = await maxPingId();

  const dbAsOwner = await call(owner, "GET", "/api/db");
  const device = dbAsOwner.json?.cheatExeDevices?.find((d) =>
    d.user.toLowerCase().startsWith(TEST_USER.toLowerCase()),
  );
  report("found the test reseller's device row", !!device, JSON.stringify(device));

  if (device) {
    cursor = await expectPing("DELETE /api/devices/:id (kick) pings 'device'", "device", cursor, () =>
      call(owner, "DELETE", `/api/devices/${device.sessionId}`),
    );
  }

  // reseller session 2 is now logged out server-side; capture ping baseline
  // before its logout call for the negative check below.
  cursor = await maxPingId();
  const rLogout = await call(reseller, "POST", "/api/auth/logout");
  report("logout call returns ok", rLogout.status === 200);
  cursor = await expectNoPing("logout does not ping", cursor, async () => rLogout);

  // ---- banned vault (ping "ban") -----------------------------------------
  console.log("\n### banned vault ###");
  cursor = await expectPing(
    "DELETE /api/banned/:username?restore=1 pings 'ban'",
    "ban",
    cursor,
    () => call(owner, "DELETE", `/api/banned/${TEST_USER}?restore=1`),
  );
  cursor = await expectNoPing(
    "DELETE /api/banned/:username on an absent record does NOT ping",
    cursor,
    () => call(owner, "DELETE", `/api/banned/${TEST_USER}?restore=1`),
  );

  // Force a fresh vault record (kick once more) so the clear-all below has
  // something real to remove.
  await call(owner, "PATCH", `/api/resellers/${TEST_USER}`, { status: "ACTIVE" });
  const rLogin3 = await call(reseller, "POST", "/api/auth/login", {
    username: TEST_USER,
    password: "ping-test-pass-2",
  });
  report("test reseller login succeeds (session 3)", rLogin3.status === 200);
  const dbAsOwner2 = await call(owner, "GET", "/api/db");
  const device3 = dbAsOwner2.json?.cheatExeDevices?.find((d) =>
    d.user.toLowerCase().startsWith(TEST_USER.toLowerCase()),
  );
  if (device3) await call(owner, "DELETE", `/api/devices/${device3.sessionId}`);
  cursor = await maxPingId();

  cursor = await expectPing("DELETE /api/banned (clear vault) pings 'ban'", "ban", cursor, () =>
    call(owner, "DELETE", "/api/banned"),
  );
  cursor = await expectNoPing("DELETE /api/banned on an empty vault does NOT ping", cursor, () =>
    call(owner, "DELETE", "/api/banned"),
  );

  // ---- history (ping "key") ----------------------------------------------
  console.log("\n### key history ###");
  // Seed a deterministic owner-created key record directly (no upstream
  // call, no money spent) so the clear has something real to remove.
  const seeded = structuredClone(snapshot);
  seeded.cheatExeKeyHistory = [
    { key: "PING-TEST-KEY", package: "Test", duration: "30", creator: "admin", date: new Date().toISOString() },
    ...seeded.cheatExeKeyHistory,
  ];
  await sql`update app_state set data = ${sql.json(seeded)} where id = 1`;
  cursor = await maxPingId();

  cursor = await expectPing("DELETE /api/history?scope=owner pings 'key'", "key", cursor, () =>
    call(owner, "DELETE", "/api/history?scope=owner"),
  );
  cursor = await expectNoPing("DELETE /api/history?scope=owner again does NOT ping", cursor, () =>
    call(owner, "DELETE", "/api/history?scope=owner"),
  );

  // ---- audit (ping "audit") ----------------------------------------------
  console.log("\n### audit log ###");
  cursor = await expectPing("DELETE /api/audit pings 'audit'", "audit", cursor, () =>
    call(owner, "DELETE", "/api/audit"),
  );

  // ---- cleanup: delete the test reseller ---------------------------------
  console.log("\n### reseller delete ###");
  cursor = await expectPing("DELETE /api/resellers/:username pings 'reseller'", "reseller", cursor, () =>
    call(owner, "DELETE", `/api/resellers/${TEST_USER}`),
  );
  cursor = await expectNoPing("DELETE /api/resellers/:username again does NOT ping", cursor, () =>
    call(owner, "DELETE", `/api/resellers/${TEST_USER}`),
  );
} finally {
  // ---- restore the exact original state, no matter what happened above --
  console.log("\n### restore ###");
  await sql`update app_state set data = ${sql.json(snapshot)} where id = 1`;
  const after = await sql`select data from app_state where id = 1`;
  const restored = JSON.stringify(after[0].data) === JSON.stringify(snapshot);
  report("app_state restored to the pre-test snapshot", restored);

  const protectedIntact = [...PROTECTED].every((u) => u in after[0].data.cheatExeUsers);
  report("protected resellers (1, 12, 22, aa) still present", protectedIntact);

  await sql.end();
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failures:");
  for (const r of results.filter((r) => !r.ok)) console.log(`  - ${r.label}: ${r.detail}`);
}
process.exit(fail ? 1 : 0);
