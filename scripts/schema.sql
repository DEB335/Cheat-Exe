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

-- ---------------------------------------------------------------------
-- Realtime doorbell.
--
-- Announcements need to land instantly, but Supabase Realtime reads
-- through the public anon key, and app_state is denied to it on purpose
-- (password hashes live there). So nothing of substance is published:
-- this table carries only "something of this kind happened, at this
-- time". The browser hears the ping and then fetches the actual content
-- through the authenticated API, which still enforces every rule about
-- who may see what.
--
-- Worst case for a leaked anon key is that someone learns an
-- announcement was sent, and when. Never what it said.
-- ---------------------------------------------------------------------
create table if not exists realtime_pings (
  id   bigserial    primary key,
  kind text         not null,
  at   timestamptz  not null default now()
);

alter table realtime_pings enable row level security;

-- Read-only, and there is nothing sensitive to read.
drop policy if exists "anon reads pings" on realtime_pings;
create policy "anon reads pings" on realtime_pings
  for select to anon, authenticated using (true);

grant select on table realtime_pings to anon, authenticated;
grant usage, select on sequence realtime_pings_id_seq to anon, authenticated;

-- Publish INSERTs to subscribers.
alter publication supabase_realtime add table realtime_pings;
