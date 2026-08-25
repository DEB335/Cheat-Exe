-- CHEAT EXE dashboard storage.
--
-- The whole dashboard state lives as one JSONB document in a single row.
-- Writes take a row lock inside a transaction, which is what makes
-- concurrent updates safe across Vercel's many Lambda instances -- the
-- in-process lock the file store used cannot work there.

create table if not exists app_state (
  id         smallint     primary key default 1,
  data       jsonb        not null,
  updated_at timestamptz  not null default now(),
  -- Enforces that exactly one row can ever exist.
  constraint app_state_singleton check (id = 1)
);

-- ---------------------------------------------------------------------
-- Row Level Security: deny everything.
--
-- Supabase publishes PostgREST for every project, and the anon key is
-- public by design. Without RLS, anyone could read this table -- password
-- hashes included -- straight from a browser.
--
-- Enabling RLS with no policies denies all access through PostgREST. The
-- app connects as the `postgres` role over direct SQL, which bypasses
-- RLS, so it is unaffected.
-- ---------------------------------------------------------------------
alter table app_state enable row level security;
alter table app_state force row level security;

revoke all on table app_state from anon, authenticated;
