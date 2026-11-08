import "server-only";

import { EventEmitter } from "node:events";
import type { Tx } from "./db";
import { sql } from "./sql";

/**
 * The kinds of change worth ringing the doorbell for. Kept as a closed
 * union rather than `string` so a typo doesn't silently mint a new kind
 * nobody listens for, and so a future client can act selectively instead
 * of treating every ping as "refetch everything":
 *
 *  - message  -- an announcement was sent, withdrawn, read, or reacted to.
 *  - reseller -- a reseller account was created, edited, or deleted.
 *  - ban      -- a device block or a banned/kicked vault record changed.
 *  - device   -- the active session list changed (cleared or a kick).
 *  - key      -- license key history changed (generated, deleted, cleared).
 *  - profile  -- the owner's branding or credentials changed.
 *  - audit    -- the audit log was cleared.
 */
export type PingKind =
  | "message"
  | "reseller"
  | "ban"
  | "device"
  | "key"
  | "profile"
  | "audit";

/**
 * Rings the doorbell that browsers are listening to.
 *
 * Deliberately content-free. Supabase Realtime reads through the public
 * anon key, and `app_state` is denied to that key on purpose -- password
 * hashes live in it -- so the only thing published is "something of this
 * kind happened". Subscribers hear the ping and then fetch the actual
 * content through the authenticated API, which still decides who may see
 * what. A leaked anon key reveals that an announcement happened and
 * when, never what it said.
 *
 * Never throws: realtime is an accelerator on top of the poll, so a
 * failure here must not fail the write that triggered it.
 *
 * Pass the transaction from `updateDb` whenever there is one. Supabase is
 * a long way from most callers -- a round trip measured 226ms from the
 * machine this was built on -- so a standalone ping would add two of them
 * to every send, which is a meaningful slice of the delay it exists to
 * remove. Riding the existing transaction costs nothing.
 */
declare global {
  // eslint-disable-next-line no-var
  var __cheatexeRealtimeEmitter: EventEmitter | undefined;
}

export function getRealtimeEmitter(): EventEmitter {
  if (!globalThis.__cheatexeRealtimeEmitter) {
    globalThis.__cheatexeRealtimeEmitter = new EventEmitter();
    globalThis.__cheatexeRealtimeEmitter.setMaxListeners(300);
  }
  return globalThis.__cheatexeRealtimeEmitter;
}

export async function ping(kind: PingKind, tx?: Tx): Promise<void> {
  // 1. In-process SSE & stream dispatch for immediate real-time updates
  try {
    getRealtimeEmitter().emit("ping", kind);
  } catch {
    /* ignore */
  }

  // 2. Supabase Postgres ping if database URL is configured
  if (!process.env.DATABASE_URL) return;

  // The kind is one of a closed set of plain words, checked here, so it
  // is written into the statement: as a parameter it would cost a second
  // round trip, because postgres.js describes every parameterised
  // statement first under `prepare: false` (see literal in lib/db.ts).
  if (!PING_KINDS.has(kind)) return;
  const insert = `insert into realtime_pings (kind) values ('${kind}')`;
  // The table is a signal, not a log, so it needs pruning -- but not on
  // every send. Doing it occasionally keeps the row count bounded
  // without spending a round trip each time.
  const prune =
    Math.random() < 0.05 ? "delete from realtime_pings where at < now() - interval '1 hour'" : null;

  if (tx) {
    // Inside a transaction the statements are only queued: they go out
    // ahead of the transaction's own write and commit, in the same batch,
    // instead of waiting a round trip here. A failure still aborts that
    // transaction, exactly as an awaited one did.
    tx.unsafe(insert).execute().catch(() => undefined);
    if (prune) tx.unsafe(prune).execute().catch(() => undefined);
    return;
  }

  try {
    const db = sql();
    await db.unsafe(insert);
    if (prune) await db.unsafe(prune);
  } catch {
    /* subscribers fall back to the poll */
  }
}

/** Every PingKind, for the check above. */
const PING_KINDS: ReadonlySet<string> = new Set<PingKind>([
  "message",
  "reseller",
  "ban",
  "device",
  "key",
  "profile",
  "audit",
]);

