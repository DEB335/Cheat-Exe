import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import type postgres from "postgres";

import { effectiveStatus } from "./reseller";
import { sql } from "./sql";
import type {
  Database,
  KeyRecord,
  ProfileSettings,
  PublicDatabase,
  Reseller,
  ResellerStatus,
} from "./types";
import { isCreatorMatch } from "./utils";

import os from "node:os";

declare global {
  var __cheatexeDbUpdatedAt: string | undefined;
  var __cheatexeMemoryDb: Database | undefined;
  var __cheatexeFileStore: FileStoreState | undefined;
}

let fileStoreUpdatedAt = globalThis.__cheatexeDbUpdatedAt ?? new Date().toISOString();

export const DEFAULT_PROFILE: ProfileSettings = {
  displayName: "Cheat Exe",
  avatar: "https://cdn.imageurlgenerator.com/uploads/9999f704-1261-4045-8d72-e616818d746e.gif",
  banner: "https://cdn.imageurlgenerator.com/uploads/696b036b-a046-46e7-a9c0-2616ffe2ddaf.gif",
};

const DEFAULT_ADMIN_USER = process.env.ADMIN_USER ?? "CHEATEXE";
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "CHEAT@EXE";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const TMP_DB_PATH = path.join(os.tmpdir(), "cheat-exe-db.json");

/**
 * The file store's moving parts, kept on globalThis beside the document
 * itself. A bundler can load this module more than once in one process;
 * a queue or an in-flight load held per copy would then not see the
 * others', and two copies' writes could interleave.
 */
interface FileStoreState {
  /** A load from disk already on its way, shared by everyone who asks meanwhile. */
  loading: Promise<Database> | null;
  /** The tail of the read-modify-write queue (withFileLock). */
  writes: Promise<unknown>;
  /** The disk save in progress, if any (saveToDisk). */
  saving: Promise<void> | null;
  /** A newer document arrived while `saving` ran and still has to be saved. */
  again: boolean;
}

const fileStore: FileStoreState = (globalThis.__cheatexeFileStore ??= {
  loading: null,
  writes: Promise.resolve(),
  saving: null,
  again: false,
});

/**
 * The file store's document, from memory whenever this process has it.
 *
 * The memory copy used to count only once this instance had *written*:
 * until then the stamp it was checked against was never set, so every
 * request -- every sign-in check, every poll -- re-read the file, parsed
 * it and normalised it, and the committed starting document carries the
 * owner password in plain text, which normalise turns into a bcrypt hash
 * each time it runs: 100-250ms of hashing per request. Now the disk and
 * the hash are paid once per process.
 *
 * Within a process the memory copy is never older than the files: every
 * write lands in it first (writeRawFile) and the disk only follows. So
 * once it exists it is the answer, whichever copy of this module asks.
 */
async function readRawFile(): Promise<Database> {
  if (!globalThis.__cheatexeMemoryDb) {
    fileStore.loading ??= loadRawFile().finally(() => {
      fileStore.loading = null;
    });
    const loaded = await fileStore.loading;
    // A write that landed while the file was being read is newer than
    // what came off disk, and has already become the copy.
    if (!globalThis.__cheatexeMemoryDb) {
      globalThis.__cheatexeMemoryDb = loaded;
      globalThis.__cheatexeDbUpdatedAt ??= fileStoreUpdatedAt;
    }
  }
  fileStoreUpdatedAt = globalThis.__cheatexeDbUpdatedAt ?? fileStoreUpdatedAt;
  return globalThis.__cheatexeMemoryDb;
}

async function loadRawFile(): Promise<Database> {
  try {
    const text = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<Database> & { adminPass?: string };
    return await normalise(parsed);
  } catch {
    try {
      const text = await fs.readFile(TMP_DB_PATH, "utf8");
      const parsed = JSON.parse(text) as Partial<Database> & { adminPass?: string };
      return await normalise(parsed);
    } catch {
      const legacyPath = path.join(process.cwd(), "old", "db.json");
      try {
        const text = await fs.readFile(legacyPath, "utf8");
        const parsed = JSON.parse(text) as Partial<Database> & { adminPass?: string };
        return await normalise(parsed);
      } catch {
        return emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));
      }
    }
  }
}

/**
 * Runs file-store read-modify-writes one at a time, the file store's
 * stand-in for the row lock. Each works on its own copy of the document
 * and commits it at the end, so without the queue two overlapping writes
 * would each start from the same copy and the later one would silently
 * drop the earlier one's change.
 */
function withFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = fileStore.writes.then(task, task);
  fileStore.writes = run.catch(() => undefined);
  return run;
}

/**
 * Commits a document: memory at once, the files behind it.
 *
 * The memory copy is what every later read is answered from, so a write
 * is done the moment it is there; the next writer in the queue need not
 * wait on two stringifications and two file writes first.
 */
async function writeRawFile(db: Database): Promise<void> {
  globalThis.__cheatexeMemoryDb = db;
  const stamp = new Date().toISOString();
  globalThis.__cheatexeDbUpdatedAt = stamp;
  fileStoreUpdatedAt = stamp;
  saveToDisk();
}

/**
 * Saves the newest document to disk, one save at a time.
 *
 * A save asked for while one is running is folded into a single
 * follow-up that writes whatever is newest by then: the files only ever
 * need the latest document, never each one in turn, and one writer means
 * the temp files can never be written by two saves at once.
 */
function saveToDisk(): void {
  if (fileStore.saving) {
    fileStore.again = true;
    return;
  }
  fileStore.saving = (async () => {
    do {
      fileStore.again = false;
      const db = globalThis.__cheatexeMemoryDb;
      if (!db) break;
      const text = JSON.stringify(db, null, 4);

      // 1. TMP_DB_PATH, always writable on serverless /tmp.
      try {
        const tmp = `${TMP_DB_PATH}.${process.pid}.tmp`;
        await fs.writeFile(tmp, text, "utf8");
        await fs.rename(tmp, TMP_DB_PATH);
      } catch {
        /* memory still holds it */
      }

      // 2. DB_PATH too, where the filesystem is writable.
      try {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
        const tmp = `${DB_PATH}.${process.pid}.tmp`;
        await fs.writeFile(tmp, text, "utf8");
        await fs.rename(tmp, DB_PATH);
      } catch {
        // Expected on read-only serverless hosts
      }
    } while (fileStore.again);
  })().finally(() => {
    fileStore.saving = null;
  });
}

function emptyDb(adminPassHash: string): Database {
  return {
    cheatExeUsers: {},
    cheatExeKeyHistory: [],
    cheatExeAuditLogs: [],
    cheatExeDevices: [],
    cheatExeBannedUsers: [],
    cheatExeBans: [],
    cheatExeMessages: [],
    cheatExeWhitelistOwners: {},
    cheatExeWhitelistEntries: [],
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

/**
 * Every field a stored document may be missing, filled with its empty
 * value. Shared by the whole-document read and the partial one, so the
 * two can never disagree about what an absent field means.
 *
 * adminPassHash is not here: its default is a bcrypt hash, which costs
 * real time and is only worth computing for a document that will be
 * written back.
 */
function withDefaults(stored: Partial<Database>): Omit<Database, "adminPassHash"> {
  return {
    cheatExeUsers: stored.cheatExeUsers ?? {},
    cheatExeKeyHistory: stored.cheatExeKeyHistory ?? [],
    cheatExeAuditLogs: stored.cheatExeAuditLogs ?? [],
    cheatExeDevices: stored.cheatExeDevices ?? [],
    cheatExeBannedUsers: stored.cheatExeBannedUsers ?? [],
    cheatExeBans: stored.cheatExeBans ?? [],
    cheatExeMessages: stored.cheatExeMessages ?? [],
    cheatExeWhitelistOwners: stored.cheatExeWhitelistOwners ?? {},
    cheatExeWhitelistEntries: stored.cheatExeWhitelistEntries ?? [],
    adminUser: stored.adminUser ?? DEFAULT_ADMIN_USER,
    profile: { ...DEFAULT_PROFILE, ...stored.profile },
    emulatorBypassMaintenance: stored.emulatorBypassMaintenance ?? { active: false },
  };
}

/** Fills in anything a stored document is missing, and migrates legacy shapes. */
async function normalise(stored: Partial<Database> & { adminPass?: string }): Promise<Database> {
  let adminPassHash = stored.adminPassHash;
  if (!adminPassHash) {
    // A document carried over from the old plaintext file store.
    adminPassHash = await bcrypt.hash(stored.adminPass ?? DEFAULT_ADMIN_PASS, 10);
  }

  return { ...withDefaults(stored), adminPassHash };
}

/** Reads the current state, seeding a fresh database on first run. */
export async function readDb(): Promise<Database> {
  if (!process.env.DATABASE_URL) {
    return readRawFile();
  }

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

/** Everything but the hash, which is left to readDb. */
type Sliceable = Omit<Database, "adminPassHash">;

/** A field that can be read on its own. */
export type SliceField = keyof Sliceable;

/**
 * Reads only the named top-level fields of the state.
 *
 * The state is one JSONB document, and nearly all of its weight is the
 * key history -- which is never trimmed -- and the audit log. The checks
 * every request runs (is this account still allowed in, is this device
 * banned, is this session still listed) read neither, yet each one used
 * to pull the whole document across the wire and parse it, and the
 * session poll alone does that every five seconds for every open tab.
 * Postgres still decompresses the row to pick the fields out, but only
 * these come back: with twenty thousand keys of history that is a few
 * kilobytes instead of a couple of megabytes, per poll.
 *
 * The result holds the named fields and nothing else. The rest are
 * absent rather than empty, so a slice handed to code that reads more
 * than it asked for fails loudly instead of answering from an empty list
 * -- which, for a quota or a ban, would be the wrong direction to fail.
 *
 * The fields are picked with one jsonb_each pass over the document.
 * `data -> field` per field decompressed the whole document again for
 * every field named -- measured at about 6ms a field against a
 * twenty-thousand-key history, where one pass costs about the same as a
 * single pick.
 */
export async function readSlice<K extends SliceField>(
  fields: readonly K[],
): Promise<Pick<Sliceable, K>> {
  if (!process.env.DATABASE_URL) {
    const source = await readRawFile();
    const slice = {} as Pick<Sliceable, K>;
    for (const field of fields) slice[field] = source[field];
    return slice;
  }

  const db = sql();
  const rows = await db<{ data: Partial<Database> | null }[]>`
    select (
      select jsonb_object_agg(key, value)
      from jsonb_each(data)
      where key = any(${[...fields]}::text[])
    ) as data
    from app_state where id = 1
  `;

  // First run: readDb seeds the document, and its answer covers any slice.
  const source: Sliceable =
    rows.length > 0 ? withDefaults(rows[0]!.data ?? {}) : await readDb();

  const slice = {} as Pick<Sliceable, K>;
  for (const field of fields) slice[field] = source[field];
  return slice;
}

/**
 * readSlice, plus the owner's password hash.
 *
 * The hash is not sliceable on its own because a document carried over
 * from the plaintext store has none, and making one is a bcrypt hash --
 * so that rare document, and a database not yet seeded, go through
 * readDb, which already handles both. Every other read is as small as
 * readSlice's: the sign-in check needs the hash and the account records,
 * never the key history.
 */
export async function readSliceWithHash<K extends SliceField>(
  fields: readonly K[],
): Promise<Pick<Sliceable, K> & { adminPassHash: string }> {
  let source: Database;
  if (!process.env.DATABASE_URL) {
    source = await readRawFile();
  } else {
    const db = sql();
    const rows = await db<{ data: Partial<Database> | null }[]>`
      select (
        select jsonb_object_agg(key, value)
        from jsonb_each(data)
        where key = any(${[...fields, "adminPassHash"]}::text[])
      ) as data
      from app_state where id = 1
    `;

    const stored = rows[0]?.data ?? {};
    const hash = typeof stored.adminPassHash === "string" ? stored.adminPassHash : "";
    source =
      rows.length > 0 && hash ? { ...withDefaults(stored), adminPassHash: hash } : await readDb();
  }

  const slice = { adminPassHash: source.adminPassHash } as Pick<Sliceable, K> & {
    adminPassHash: string;
  };
  for (const field of fields) slice[field] = source[field];
  return slice;
}

/**
 * updateDb for a few fields: the same row lock and the same transaction,
 * but only the named fields cross the wire, in either direction.
 *
 * updateDb pulls the whole document into this process, parses it, and
 * writes every byte of it back -- the key history included, which is
 * never trimmed and is most of the document. A sign-in, a mint or an
 * audit line touches a few small fields, so paying for the history twice
 * on each was most of what made them slow. Here the slice comes back,
 * `mutate` changes it in place (or replaces a field outright), and only
 * those fields are merged back into the stored document with `||`.
 *
 * A field `mutate` did not touch is written back unchanged, which is
 * harmless: the row is locked from the first statement, so nothing can
 * have changed it in between. Fields outside the slice are not read and
 * not written. When `mutate` changed nothing at all, nothing is written.
 *
 * Every UPDATE of this row re-compresses and rewrites the whole stored
 * document, history included, so the key history -- which is never in a
 * slice -- is edited through `history`, folded into the same single
 * UPDATE as the slice. Two statements would pay that rewrite twice.
 * The history is kept out of `fields` for the same reason it is never
 * read here: a stale copy merged back would undo the edit.
 */
export async function updateSlice<K extends SlicedField, T>(
  fields: readonly K[],
  mutate: (slice: Pick<Sliceable, K>, tx: Tx) => T | Promise<T>,
  history?: HistoryEdit,
): Promise<T> {
  // No database configured: the same contract over the file store, which
  // holds the whole document in memory anyway. There is no transaction,
  // so `tx` is undefined, as it is for updateDb's file path -- ping()
  // already copes, and countKeysBy and ownerHashIn below check for it.
  if (!process.env.DATABASE_URL) {
    return withFileLock(async () => {
      // A copy, committed only once mutate returns: one that throws
      // halfway must not leave the shared in-memory document half changed.
      const current = structuredClone(await readRawFile());
      const slice = {} as Pick<Sliceable, K>;
      for (const field of fields) slice[field] = current[field];
      const before = JSON.stringify(slice);

      const result = await mutate(slice, undefined as unknown as Tx);

      for (const field of fields) (current as Sliceable)[field] = slice[field];
      let historyChanged = false;
      if (history && "prepend" in history && history.prepend.length > 0) {
        for (const record of history.prepend) current.cheatExeKeyHistory.unshift(record);
        historyChanged = true;
      } else if (history && "remove" in history) {
        const kept = current.cheatExeKeyHistory.filter((k) => k.key !== history.remove);
        historyChanged = kept.length !== current.cheatExeKeyHistory.length;
        current.cheatExeKeyHistory = kept;
      }
      if (historyChanged || JSON.stringify(slice) !== before) await writeRawFile(current);
      return result;
    });
  }

  const db = sql();

  return db.begin(async (tx) => {
    // The lock first, on its own: a plain row lock is unambiguous, where
    // `for update` on a query that aggregates is not allowed everywhere.
    let locked = await tx`select id from app_state where id = 1 for update`;
    if (locked.length === 0) {
      // First run. Seed the document inside this transaction so the
      // slice below has something to read, then take the lock on it.
      const fresh = emptyDb(await bcrypt.hash(DEFAULT_ADMIN_PASS, 10));
      await tx`
        insert into app_state (id, data) values (1, ${tx.json(asJson(fresh))})
        on conflict (id) do nothing
      `;
      locked = await tx`select id from app_state where id = 1 for update`;
    }

    const rows = await tx<{ data: Partial<Database> | null }[]>`
      select (
        select jsonb_object_agg(key, value)
        from jsonb_each(data)
        where key = any(${[...fields]}::text[])
      ) as data
      from app_state where id = 1
    `;
    const source = withDefaults(rows[0]?.data ?? {});

    const slice = {} as Pick<Sliceable, K>;
    for (const field of fields) slice[field] = source[field];
    const before = JSON.stringify(slice);

    const result = await mutate(slice, tx);

    const patch: Partial<Sliceable> = {};
    for (const field of fields) patch[field] = slice[field];
    const merged = tx.json(asJson(patch as Database));
    const sliceChanged = JSON.stringify(patch) !== before;

    if (history && "prepend" in history && history.prepend.length > 0) {
      // Same order as `for (const r of records) history.unshift(r)`: the
      // last record ends up first, so a batch reads as it always has.
      const newestFirst = [...history.prepend].reverse();
      await tx`
        update app_state
        set data = jsonb_set(
          data || ${merged}::jsonb,
          '{cheatExeKeyHistory}',
          ${tx.json(newestFirst as unknown as Parameters<Tx["json"]>[0])}::jsonb
            || coalesce(data -> 'cheatExeKeyHistory', '[]'::jsonb)
        ),
        updated_at = now()
        where id = 1
      `;
    } else if (history && "remove" in history) {
      // `history.filter((k) => k.key !== key)`, in Postgres. A record with
      // no key at all is kept, as the filter keeps it. When the key is not
      // in the history the history is left alone and only the slice is
      // merged -- or nothing is written, if the slice did not change.
      const key = history.remove;
      await tx`
        update app_state
        set data = case
          when coalesce(data -> 'cheatExeKeyHistory', '[]'::jsonb)
            @> jsonb_build_array(jsonb_build_object('key', ${key}::text))
          then jsonb_set(
            data || ${merged}::jsonb,
            '{cheatExeKeyHistory}',
            jsonb_path_query_array(
              data -> 'cheatExeKeyHistory',
              '$[*] ? (!(@.key == $k))',
              jsonb_build_object('k', ${key}::text)
            )
          )
          else data || ${merged}::jsonb
        end,
        updated_at = now()
        where id = 1
          and (
            ${sliceChanged}
            or coalesce(data -> 'cheatExeKeyHistory', '[]'::jsonb)
              @> jsonb_build_array(jsonb_build_object('key', ${key}::text))
          )
      `;
    } else if (sliceChanged) {
      await tx`
        update app_state
        set data = data || ${merged}::jsonb, updated_at = now()
        where id = 1
      `;
    }

    return result;
  }) as Promise<T>;
}

/** Every slice field except the key history -- see updateSlice. */
export type SlicedField = Exclude<SliceField, "cheatExeKeyHistory">;

/** A change to the key history, made in updateSlice's single UPDATE. */
export type HistoryEdit =
  /** New records, put at the top in `unshift` order. */
  | { prepend: KeyRecord[] }
  /** Every record for this key, dropped. */
  | { remove: string };

/**
 * How many keys of the history this user created, counted in Postgres.
 *
 * keysUsedBy does the same over a whole document in memory; this is for
 * a caller holding only a slice, so the history never leaves the
 * database just to be counted. Run it on updateSlice's `tx` to count
 * under the same lock the quota is written under.
 *
 * The match is isCreatorMatch's, written in SQL: the creator equals the
 * name, or starts with the name and then a space or "(", or equals it
 * once anything from the first "(" or "[" on is cut off -- so
 * "ALPHA (RESELLER)" counts as ALPHA's, exactly as keysUsedBy counts it.
 * The pattern goes as a parameter: a backslash written into the query
 * text would be eaten by the template literal before Postgres saw it.
 */
export async function countKeysBy(tx: Tx | undefined, username: string): Promise<number> {
  if (!process.env.DATABASE_URL || !tx) return keysUsedBy(await readRawFile(), username);

  const name = username.toLowerCase().trim();
  if (!name) return 0;
  const rows = await tx<{ n: number }[]>`
    select count(*)::int as n
    from app_state,
      jsonb_array_elements(coalesce(data -> 'cheatExeKeyHistory', '[]'::jsonb)) as k,
      lateral (select lower(trim(k ->> 'creator')) as c) as creator
    where id = 1
      and creator.c is not null and creator.c <> ''
      and (
        creator.c = ${name}
        or starts_with(creator.c, ${name + " "})
        or starts_with(creator.c, ${name + "("})
        or coalesce(
          nullif(trim(regexp_replace(creator.c, ${"\\s*[([].*$"}, '')), ''),
          creator.c
        ) = ${name}
      )
  `;
  return rows[0]?.n ?? 0;
}

/**
 * The owner's password hash as it stands inside updateSlice's lock.
 *
 * Read on `tx`, never on the pool: the pool has three connections, and a
 * second one taken while this transaction holds the row lock can starve
 * under load. Null when the stored document has none (a legacy one), so
 * the caller can fall back to the hash it read before taking the lock.
 * With no database configured there is no transaction, and the file
 * store's copy is the answer.
 */
export async function ownerHashIn(tx: Tx | undefined): Promise<string | null> {
  if (!process.env.DATABASE_URL || !tx) return (await readRawFile()).adminPassHash || null;
  const rows = await tx<{ hash: string | null }[]>`
    select data ->> 'adminPassHash' as hash from app_state where id = 1
  `;
  return rows[0]?.hash ?? null;
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
  if (!process.env.DATABASE_URL) {
    return withFileLock(async () => {
      // A copy, committed only once mutate returns -- see updateSlice.
      const current = structuredClone(await readRawFile());
      const result = await mutate(current, undefined as unknown as Tx);
      await writeRawFile(current);
      return result;
    });
  }

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
    emulatorBypassMaintenance: db.emulatorBypassMaintenance ?? { active: false },
  };
}

/** Case-insensitive lookup, matching the original login behaviour. */
export function findReseller(
  db: Pick<Database, "cheatExeUsers">,
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
  db: Pick<Database, "adminUser" | "cheatExeBannedUsers" | "cheatExeUsers">,
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
export function expireOverdue(db: Pick<Database, "cheatExeUsers">): number {
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
  return db.cheatExeKeyHistory.filter((k) => isCreatorMatch(k.creator, username)).length;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Returns the latest updated_at timestamp of the database */
export async function getDbUpdatedAt(): Promise<string> {
  const localStamp = globalThis.__cheatexeDbUpdatedAt ?? fileStoreUpdatedAt;
  if (!process.env.DATABASE_URL) {
    return localStamp;
  }
  try {
    const db = sql();
    const rows = await db<{ updated_at: Date | string }[]>`
      select updated_at from app_state where id = 1
    `;
    if (rows.length > 0 && rows[0]?.updated_at) {
      return new Date(rows[0].updated_at).toISOString();
    }
  } catch {
    /* fallback */
  }
  return localStamp;
}
