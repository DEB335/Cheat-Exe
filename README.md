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
| `TX999_API_URL` / `TX999_API_KEY` | Optional override for the UID whitelist. It now runs on the license API above, with the same key, so leave both unset |
| `UID_BYPASS_MAINTENANCE` | Set to `1` to show the maintenance notice and refuse whitelist writes. Unset otherwise |

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

### UID Bypass moved onto the license API

It used to be a service of its own — `terminalx999.live/api.php`, a GET
with query parameters, its own reseller key, its own `reseller_*` actions.
**That host no longer resolves.** The whitelist is now three actions on
`api_admin.php`: `whitelist_uid`, `remove_uid` and `get_whitelisted_uids`,
reached by JSON POST with the same admin key the license API uses.

So `TX999_API_URL` and `TX999_API_KEY` fall back to `LICENSE_API_URL` and
`LICENSE_API_KEY`. Leave them unset. A stale value beats the fallback and
is rejected, which is the one way left to break this section from config —
including a value still sitting in a host dashboard from before the move.
`lib/uid-api.ts` is still the only thing that speaks to it.

What changed in behaviour, not just in spelling:

- **The player name is verified now.** The provider looks the UID up in
  the game, refuses one it cannot find, and answers with the real in-game
  name. The old service stored any name against any number. So `name` is
  an output, and the operator's own label moved to `note`.
- **Region is real.** The old service ignored `region`, `server` and
  `region_code` alike and reported `ALL SERVER` for everything. The API
  takes one of IND, BD, BR, SG, RU, ID, TW, US, VN or PK, so the form
  offers a dropdown and the route refuses anything outside that list —
  a wrong region still spends a credit. Entries predating the move still
  read `ALL SERVER`.
- **Removal distinguishes absent from removed.** A UID the provider does
  not hold answers `404`, where the old service reported success either
  way. That is not treated as an error — it is what was asked for — but
  it is reported, so a bulk delete says how many were actually on the
  list. `removeWhitelist` returns that as a boolean.
- **Minimum UID length is 6 digits**, down from 8.
- **`message` is filled on success too.** Only `success` decides. Reading
  `message` the way the old service's `error` was read turns every good
  reply into a failure.
- **There is still no update action**, and `whitelist_uid` refuses a UID
  it already holds. Extending validity is therefore remove-then-add, which
  runs server-side in `PATCH` so the unwhitelisted window is milliseconds
  rather than a browser round trip, and retries once before reporting.

Records are mapped field by field onto `WhitelistEntry` rather than
forwarded. The whitelist shares an endpoint — and a credential — with the
license API now, so a record passed through whole is one new upstream
field away from carrying something privileged into a browser.

One key backs the whole panel, and upstream stamps every entry
`created_by: cheatexe` whoever added it. `cheatExeWhitelistOwners` records
the real author per UID so one reseller cannot delete another's customer.
It is server-side only, so it never reaches a browser. A UID with no
recorded owner (added from the provider's own panel, or before this
existed) belongs to the owner rather than to whoever asks first.

The credit balance is still not readable. `get_my_api_key` belonged to the
retired service and `api_admin.php` does not offer it; `reseller_stats`,
which it does offer, counts license keys rather than whitelist credits.
That is why no credits tile is shown and why `/uid credits` says so
instead of reporting a number that would mean something else.

### Maintenance is a state, not an error

When the whitelist cannot be used, the section shows a maintenance notice
in place of the form rather than a red line above it. Every control there
spends a credit, so one that still looks available is an invitation to pay
for a call that cannot succeed.

It turns on two ways:

- **On its own**, when the read fails with a 5xx — the provider unreachable,
  or a key it will not take. `GET /api/uid-bypass` reports that as
  `maintenance: true` with a `reason` rather than throwing. Anything in the
  400s still throws: those are answers about the request, not the service.
- **By hand**, with `UID_BYPASS_MAINTENANCE=1`. This is the case the API
  cannot tell you about: the provider's own panel shows *UID Whitelist
  Service Under Maintenance* while `get_whitelisted_uids` carries on
  answering `success: true` with an empty list. Nothing in the response
  says so, so nothing but a switch can.

Set by hand it also refuses `POST`, `PATCH` and `DELETE` with a 503, so a
stale tab or a direct call cannot spend a credit behind the notice. The
automatic case needs no such guard: a write goes to the same provider the
read could not reach, and fails on its own.


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
| `TX999_API_URL` | leave unset — falls back to `LICENSE_API_URL` |
| `TX999_API_KEY` | leave unset — falls back to `LICENSE_API_KEY`. **Remove any value left over from the old `terminalx999.live` service**: it overrides the fallback and is rejected |
| `UID_BYPASS_MAINTENANCE` | `1` while the provider is down. Unset otherwise |

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
