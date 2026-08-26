import "server-only";

import type { Tx } from "./db";
import { sql } from "./sql";

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
export async function ping(kind: "message", tx?: Tx): Promise<void> {
  try {
    const db = tx ?? sql();
    await db`insert into realtime_pings (kind) values (${kind})`;

    // The table is a signal, not a log, so it needs pruning -- but not on
    // every send. Doing it occasionally keeps the row count bounded
    // without spending a round trip each time.
    if (Math.random() < 0.05) {
      await db`delete from realtime_pings where at < now() - interval '1 hour'`;
    }
  } catch {
    /* subscribers fall back to the poll */
  }
}
