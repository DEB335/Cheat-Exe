import "server-only";

import postgres from "postgres";

const CONNECTION = process.env.DATABASE_URL;

/**
 * Shared Postgres handle.
 *
 * Cached on globalThis so Next's dev HMR and warm Lambda invocations
 * reuse one pool instead of opening a new one per reload.
 *
 * `prepare: false` is required by Supabase's transaction-mode pooler
 * (port 6543): connections are handed out per statement, so server-side
 * prepared statements cannot be relied on.
 */
const globalForSql = globalThis as unknown as {
  __cheatexeSql?: ReturnType<typeof postgres>;
};

export function sql() {
  if (!CONNECTION) {
    throw new Error(
      "DATABASE_URL is not set. Use the Supabase transaction pooler string " +
        "(postgres.<ref>@aws-0-<region>.pooler.supabase.com:6543) and percent-encode the password.",
    );
  }

  globalForSql.__cheatexeSql ??= postgres(CONNECTION, {
    prepare: false,
    // Serverless invocations are short-lived; a small pool avoids
    // exhausting the pooler's client limit across many instances.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
  });

  return globalForSql.__cheatexeSql;
}
