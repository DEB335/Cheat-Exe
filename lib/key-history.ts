import "server-only";

import { updateDb, type Tx } from "./db";
import { sql } from "./sql";

/** What to do to every history row for one key. */
export type KeyRowEdit = { banned: boolean } | "delete";

/**
 * Applies `edit` to every key-history row whose key matches `key`,
 * ignoring case -- the same match the key routes have always used --
 * and answers whether any row changed.
 *
 * With Postgres it is one UPDATE, done inside the database: the history
 * is most of the document and never needs to come into this process for
 * a flag on one row. The `exists` guard means a key with nothing to
 * change writes nothing, so checking a key whose flag is already right
 * costs a read, not a rewrite. Pass updateSlice's `tx` to make it part
 * of that transaction; without one it runs on its own.
 *
 * With no database configured it goes through the file store's updateDb.
 * Call it outside updateSlice there: both read the in-memory document,
 * and a nested write could be overwritten by the outer one.
 */
export async function editKeyRows(
  key: string,
  edit: KeyRowEdit,
  tx?: Tx,
): Promise<boolean> {
  const wanted = key.trim().toUpperCase();
  if (!wanted) return false;

  if (!process.env.DATABASE_URL) {
    return updateDb((db) => {
      const matches = (k: { key?: string }) => (k.key ?? "").toUpperCase() === wanted;
      if (edit === "delete") {
        const kept = db.cheatExeKeyHistory.filter((k) => !matches(k));
        const changed = kept.length !== db.cheatExeKeyHistory.length;
        db.cheatExeKeyHistory = kept;
        return changed;
      }
      let changed = false;
      for (const k of db.cheatExeKeyHistory) {
        if (matches(k) && k.banned !== edit.banned) {
          k.banned = edit.banned;
          changed = true;
        }
      }
      return changed;
    });
  }

  const db = tx ?? sql();

  if (edit === "delete") {
    const rows = await db`
      update app_state
      set data = jsonb_set(
        data,
        '{cheatExeKeyHistory}',
        (
          select coalesce(jsonb_agg(k order by i), '[]'::jsonb)
          from jsonb_array_elements(data -> 'cheatExeKeyHistory') with ordinality as h(k, i)
          where upper(k ->> 'key') is distinct from ${wanted}
        )
      ),
      updated_at = now()
      where id = 1
        and jsonb_typeof(data -> 'cheatExeKeyHistory') = 'array'
        and exists (
          select 1 from jsonb_array_elements(data -> 'cheatExeKeyHistory') as k
          where upper(k ->> 'key') = ${wanted}
        )
      returning id
    `;
    return rows.length > 0;
  }

  // `banned` absent counts as different from false, as `k.banned !==
  // false` does in memory, so the first check of a key records the flag.
  const rows = await db`
    update app_state
    set data = jsonb_set(
      data,
      '{cheatExeKeyHistory}',
      (
        select coalesce(
          jsonb_agg(
            case
              when upper(k ->> 'key') = ${wanted}
              then k || jsonb_build_object('banned', ${edit.banned}::boolean)
              else k
            end
            order by i
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(data -> 'cheatExeKeyHistory') with ordinality as h(k, i)
      )
    ),
    updated_at = now()
    where id = 1
      and jsonb_typeof(data -> 'cheatExeKeyHistory') = 'array'
      and exists (
        select 1 from jsonb_array_elements(data -> 'cheatExeKeyHistory') as k
        where upper(k ->> 'key') = ${wanted}
          and (k ->> 'banned') is distinct from ${String(edit.banned)}
      )
    returning id
  `;
  return rows.length > 0;
}
