# CHEAT EXE — Dashboard

Next.js 16 + React 19 + Tailwind v4 port of the static panel in [`old/`](./old).

The layout is a pixel-for-pixel reproduction: every element was measured
against the original and matches at `y+0 h+0 w+0` (see
[Verifying fidelity](#verifying-fidelity)). What changed is everything
underneath — authentication, data access and role enforcement now happen
on the server.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the values below
node scripts/seed.mjs          # migrates old/db.json -> data/db.json
npm run dev
```

Open http://localhost:3000. Sign in with the owner account from
`old/db.json` (or whatever `ADMIN_PASSWORD` you set before seeding).

### Environment

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs the session cookie. 32+ chars. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `LICENSE_API_URL` | Upstream license API (`https://auth.terminalx999.online/api_admin.php`) |
| `LICENSE_API_KEY` | Upstream API key — **server-side only**, never shipped to the browser |
| `LICENSE_APP_ID` | Upstream app id |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Owner account, used only when seeding a fresh database |
| `TX999_API_URL` / `TX999_API_KEY` | UID whitelist behind the UID Bypass section (`https://terminalx999.live/api.php`). A different service from the license API — **server-side only** |

---

## What changed, and why

### Authentication is real now

The original compared the typed password against `localStorage`, which was
populated from an unauthenticated `GET /api/db` that returned
`adminPass` in plaintext — anyone could `curl` the endpoint and read the
owner password. The license API key was hardcoded in client JS. Role
separation was a CSS class.

In the port:

- Passwords are bcrypt hashes. `lib/db.ts` migrates the old plaintext
  values on first read, and **no hash ever leaves the server** (`toPublic`).
- Sessions are signed JWTs in an httpOnly cookie (`lib/session.ts`).
- `proxy.ts` gates every dashboard route; owner-only routes redirect
  resellers to `/dashboard`.
- `GET /api/db` scopes its response by role — a reseller receives only
  their own keys, their own session and their own audit lines. The
  reseller list and banned vault are simply absent from the payload.
- Every mutating route re-checks the role server-side. A reseller cannot
  generate keys for a package they were not granted, whatever the UI shows.
- The license API key lives in an env var and is attached inside
  `app/api/keys/route.ts`.

### The upstream API is used properly

`lib/license-api.ts` is the single entry point to `api_admin.php`. Beyond
the five actions the original called, the port now uses three more:

| Endpoint | Upstream action | What it fixes |
| --- | --- | --- |
| `GET /api/stats` | `reseller_stats` | The overview tiles showed counts derived from `localStorage`, which drifts the moment a key is issued or revoked anywhere else. They now show real figures. |
| `GET /api/packages` | `get_admin_packages` | The package list was hardcoded. It is now fetched live, falling back to the bundled list if the API is unreachable. |
| `POST /api/keys/info` | `key_info` | New Lookup action on Manage Key: status, package, created, expiry, HWID and IP. The API always supported it; the panel never called it. |

The API supports eleven further actions the panel does not use --
`discord_bot_setup`, `get_discord_config`, `unbind_discord_server`,
`save_discord_oauth`, `get_discord_oauth_tokens`, `check_discord_oauth`,
`pull_discord_members`, `delete_oauth_token`,
`purge_invalid_oauth_tokens`, `setup_free_panel`, `claim_free_panel_key`.

Responses carry a `signature` (sha256). The port passes it through but
cannot verify it without the signing scheme from the API provider --
worth asking them for, since it would let the server confirm responses
are genuine.

### Known upstream issue: validity is ignored

The **Validity (days)** field has never had any effect. Tested against
the live API with `duration`, `days`, `expiry`, `duration_days` and
`validity`, across three packages: every key comes back
`duration_days: 0` / `expiry_date: "Never (Lifetime)"`.

Every key this panel has ever issued is a lifetime key. The generator now
says so under the field. Fixing it properly needs a change on the API
side, or the correct parameter name from whoever runs it.

### UID Bypass runs on a second, blunter API

The UID Bypass section talks to `terminalx999.live/api.php`, which is not
the license API and behaves nothing like it. Three actions exist —
`reseller_add`, `reseller_remove`, `reseller_list` — and everything else
answers "Method not allowed" or an empty 200 body. `lib/uid-api.ts` is the
only thing that speaks to it.

Four of its behaviours shape the UI, and each one is the opposite of what
the API appears to offer:

- **`reseller_list` echoes the API key back** in an `api_key_ref` field on
  every record. That key is the integration's only credential, so the
  route maps records onto `WhitelistEntry` — a type with nowhere to put
  it — rather than forwarding what it received.
- **Region cannot be set.** `region`, `server` and `region_code` are all
  ignored and every entry returns `ALL SERVER`, so the form shows a fixed
  chip instead of a dropdown that would quietly do nothing.
- **The player name is not verified.** It is stored exactly as typed, so
  the field is labelled as a reference, not a check.
- **There is no update action**, and `reseller_add` refuses a UID it
  already holds. Extending validity is therefore remove-then-add, which
  runs server-side in `PATCH` so the unwhitelisted window is milliseconds
  rather than a browser round trip, and retries once before reporting.

One key backs the whole panel, and upstream stamps every entry
`created_by: cheatexe` whoever added it. `cheatExeWhitelistOwners` records
the real author per UID so one reseller cannot delete another's customer.
It is server-side only — `toPublic` builds its result from a fixed list of
fields, so it never reaches a browser. A UID with no recorded owner (added
from the Discord bot, from the provider's own panel, or before this
existed) belongs to the owner rather than to whoever asks first.

The credit balance is not readable: `get_my_api_key` is the login call
that issues the key, so it wants a username and password, not a key. That
is why no credits tile is shown.

### Writes are serialised

The original `POST /api/db` overwrote the whole file with whatever the
browser sent, last-writer-wins. `lib/db.ts` funnels all reads and writes
through one promise chain and writes via a temp file + rename, so
concurrent requests cannot interleave or truncate the database.

### Dead code dropped

- `admin.html` — orphaned, nothing linked to it.
- The "Premium Interactive Comet Sky" background — duplicated verbatim in
  two IIFEs, both animating a canvas that was `display: none`. Two
  `requestAnimationFrame` loops rendering nothing.
- `downloadExe()` / `updateBrandPreview()` — referenced `#brandName1`,
  `#brandName2` and `.exe-table`, none of which exist in the markup. The
  `/build_exe` rewrite in `vercel.json` served this dead feature.

### Deliberate deviations

These are the only places the port does not reproduce the original. Each
is a consequence of a decision you approved, and each is one edit to undo.

1. **Fonts actually load.** The original's Google Fonts `@import` sits
   after other rules in the `<style>` block, so browsers drop it per spec
   — `index.html` has never rendered in Outfit / Plus Jakarta Sans, only
   in the system fallback. (`login.html` loads them correctly via
   `<link>`, which is why that page always looked different.) The port
   loads both via `next/font`. To reproduce the original's fallback
   rendering instead, set `--font-sans` / `--font-display` to
   `sans-serif` in `app/globals.css`.

2. **The vault cannot show passwords.** The original stored reseller
   passwords in plaintext and displayed them in the Banned & Kicked
   Vault. Once passwords are hashed there is nothing to reveal, so that
   column reads "not recoverable". Use **Pass** on the reseller row to set
   a new password.

   The Profile page keeps its **Password** field, but it starts empty and
   only submits when the owner types a new one — the stored value is a
   hash, so there is nothing to pre-fill. The original pre-filled it with
   the plaintext password.

3. **The tether button locks on "complete", not "correct".** The login
   button dodged the cursor until the typed credentials *matched*, which
   required the real password in the browser. It now snaps home and locks
   green once both fields are filled, and turns red on a rejected submit.
   The dodge physics, elastic cord, snap chord and bolt-away are
   unchanged. Restoring the exact original behaviour would need an
   unauthenticated "is this password right?" endpoint, i.e. a
   brute-force oracle.

4. **Light mode is reachable.** The original ships a complete light
   theme and a View Transitions circular-reveal toggle, but no control
   ever called it (`toggleTheme` targeted `#themeToggle`, which is not in
   the DOM). The port wires it into the profile dropdown. To drop it,
   delete the `Light Mode` item in `components/layout/Header.tsx`.

5. **Below 1024px the layout adapts.** The original has one media query
   total and is desktop-only. At `lg` and above the port is pixel-exact;
   below it the sidebar becomes a drawer, cards stack and tables scroll.

---

## Layout

```
app/
  (dash)/            dashboard shell + one route per section
  api/               auth, db, keys (+ info, manage), stats, packages,
                     resellers, devices, banned, audit, history, profile
  login/             sign-in page
components/
  effects/           background video, cursor sparks, click wave
  layout/            sidebar, header
  login/             tether button
  ui/                buttons, cards, table, form, modal, toast, badges
lib/                 db, session, auth, license-api, store, sounds, nav, types
proxy.ts             route guard (Next 16 renamed middleware -> proxy)
data/db.json         the database (gitignored)
```

### Tailwind

Design tokens live as CSS variables on `:root` / `body.light-mode` and are
exposed to Tailwind through `@theme inline`, so `bg-accent`,
`text-muted` and `border-line` follow the theme automatically. Light mode
is the `lt:` variant — the inverse of the usual `dark:`, since this design
is dark by default.

Four effects have no utility equivalent and are registered as real
Tailwind utilities with `@utility` in `app/globals.css`:
`glow-ring` (the masked conic-gradient border), `sidebar-ring`,
`scanlines` and `text-rgb-flow`.

---

## Verifying fidelity

Two scripts compare the port against the original. Serve `old/` first:

```bash
cd old && python -m http.server 3211
```

```bash
node scripts/measure.mjs http://localhost:3211 http://localhost:3000
```

Prints element geometry side by side with the delta. Note that text
line-boxes differ while the port loads real fonts and the original does
not — to compare layout alone, temporarily set `--font-sans` and
`--font-display` to `sans-serif`, which yields `y+0 h+0` on every probe.

```bash
node scripts/compare.mjs ./shots http://localhost:3211 http://localhost:3000
node scripts/mobile.mjs ./shots http://localhost:3000
```

Screenshot pairs for visual diffing, and a mobile pass that reports
horizontal overflow.

---

## Deploying

Runs on Vercel. State lives in Supabase Postgres, not on disk -- Vercel's
filesystem is read-only, which is what the original file store hit.

### One-time setup

```bash
npm install
# Paste the schema into the Supabase SQL editor, or:
psql "$DATABASE_URL" -f scripts/schema.sql

node --env-file=.env.local scripts/migrate.mjs   # copies existing data across
```

### Environment variables

Set these in Vercel under **Settings -> Environment Variables** (all
environments), and locally in `.env.local`:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler**, port 6543 |
| `SESSION_SECRET` | 32+ random chars |
| `LICENSE_API_URL` | `https://auth.terminalx999.online/api_admin.php` |
| `LICENSE_API_KEY` | server-side only |
| `LICENSE_APP_ID` | |
| `TX999_API_URL` | `https://terminalx999.live/api.php` |
| `TX999_API_KEY` | server-side only. Omit it and the UID Bypass pages report the section as unconfigured rather than failing oddly |

### Use the transaction pooler, not the direct connection

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Two reasons the direct `db.<ref>.supabase.co:5432` host fails on Vercel:

- It has no IPv4 address. Vercel functions cannot route IPv6, so the
  connection never opens.
- It allocates one connection per client. Vercel runs many short-lived
  instances, which exhausts the limit.

The transaction pooler is IPv4 and returns each connection to the pool
after every transaction. It also cannot use server-side prepared
statements, which is why `lib/sql.ts` sets `prepare: false`.

Percent-encode any special characters in the password -- an unescaped
`#` truncates the URL and the client silently authenticates with the
wrong password.

### Storage design

The whole dashboard state is one JSONB row in `app_state`. `updateDb()`
reads it with `select ... for update` inside a transaction, so
simultaneous writes queue instead of overwriting each other. Verified
with eight concurrent creates: all eight survived, where the file store
would have lost most of them.

Audit logs are capped at 100 and devices at 50, so only key history
grows. Splitting the document into proper tables is straightforward if it
ever gets large.

### Row Level Security is not optional

Supabase publishes a PostgREST API for every project, and the anon key is
public by design. `scripts/schema.sql` enables RLS on `app_state` with no
policies and revokes access from `anon` and `authenticated`, so the
public API cannot touch it. The app connects as `postgres`, which
bypasses RLS.

Verified: `anon` and `authenticated` both get `42501 permission denied`;
the app role reads normally. Without this the database is readable by
anyone, password hashes included.

### Do not add the Supabase JS client

`@supabase/supabase-js` and `@supabase/ssr` are for apps that use
Supabase Auth and query from the browser with a `NEXT_PUBLIC_` key. This
app authenticates itself and queries only from the server, and PostgREST
cannot express the row-level locking `updateDb()` depends on.
