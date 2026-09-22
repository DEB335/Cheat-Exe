# CHEAT EXE Discord bot

Slash commands over the same TERMINALX999 admin API the web panel uses,
so a key issued here appears in the panel and vice versa.

## Setup

```bash
cd bot
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                               # then fill it in
python bot.py
```

`DISCORD_GUILD_ID` is your server's id (enable Developer Mode in Discord,
right-click the server, Copy Server ID). Every command refuses to run
anywhere else.

Fill `LICENSE_API_KEY` and `LICENSE_APP_ID` with the same values the web
panel uses. **They are not in this repository on purpose** -- the API key
is a live admin credential, so it lives in `.env`, which is gitignored.

## Commands

| Command | Does |
|---|---|
| `/genkey package days count` | Generates keys, posted publicly with action buttons |
| `/info key` | Looks a key up: package, status, expiry, HWID, IP |
| `/reset key` | Clears the HWID lock so it can move machines |
| `/ban key` | Blocks the key |
| `/unban key` | Restores it |
| `/delete key` | Removes it permanently |
| `/uid add uid region days note` | Whitelists a UID for the bypass, posted publicly |
| `/uid remove uid` | Takes a UID off the whitelist |
| `/uid list` | Shows the whitelist with region, expiry and days left |
| `/uid credits` | Explains that the provider exposes no balance |

`/genkey` and `/uid add` post to the channel so the server has a record;
everything else answers privately.

The `/uid` commands register alongside the rest now: the whitelist moved
onto the licence API and shares its key, so there is nothing extra to
configure -- see below.

The buttons under a generated key keep working after a restart. They carry
the key in their `custom_id` and are handled by a global listener rather
than a view object, which would die with the process.

## Announcement bridge: Discord -> the panel

A post in **#client-announcement** (the one under *panel clients*) becomes
an announcement on every client's dashboard, so a notice is written once
rather than twice. It arrives there identically to one typed into the
panel -- same reactions, same read receipts -- with a small Discord badge
so the two can be told apart.

Set four things in `bot/.env`, and `DISCORD_BRIDGE_SECRET` in the panel's
environment as well (the same value in both places):

| Variable | Meaning |
|---|---|
| `ANNOUNCE_CHANNEL_ID` | The channel's id. Already filled in `.env.example` |
| `PANEL_INGEST_URL` | `https://your-panel/api/messages/ingest` |
| `DISCORD_BRIDGE_SECRET` | Long random string, identical on both sides |
| `ANNOUNCE_ALLOWED_IDS` | Optional. Narrows broadcasting to these role or user ids |

Leave any of the first three blank and the bridge stays off; everything
else about the bot is unaffected.

**The channel is matched by id, never by name.** The server has a second
announcements channel under the regulation category, and a name can be
changed or duplicated across categories -- an id cannot. Threads started
under the channel carry their own id, so side-discussion in a thread is
not broadcast either.

Ignored on the way in: other bots, webhook posts (which is how crossposted
content arrives if this is an Announcement channel), and anyone
`ANNOUNCE_ALLOWED_IDS` does not name -- or, when that is blank, anyone
Discord does not let post in the channel anyway.

**Who may broadcast is decided by the channel, not by the bot.** Whoever
can write in #client-announcement can reach every client, so that channel's
Send Messages list *is* the permission -- which is the one you see and
maintain in Discord. It denies Send to @everyone and to the Client role, so
clients read it without being able to post. The bot used to demand Manage
Messages on top, which sounds stricter but was simply a different rule: a
Founder could post there and hold neither, and the notice vanished with
only a log line to show for it.

Attachments are appended to the text as links, because the panel stores
plain text and an image-only post would otherwise arrive blank. Anything
past the panel's 1000-character limit is cut rather than refused: better
that most of a notice lands than that it silently fails to.

**Deleting the post in Discord withdraws it from the panel too**, so a
notice sent by mistake can be taken back in the place it was written
rather than in two. Bulk deletes count. Deleting something that was never
forwarded does nothing, which is most deletions in that channel -- the bot
reports them all and lets the panel find nothing to remove. Editing a post
is not mirrored: only the text as first posted is ever sent.

### While the bot is offline

Nothing is lost as long as it comes back. `bot/.announce-state.json`
records the last message forwarded, and on startup the bot re-reads the
channel from that point and sends what it missed. On the very *first* run
it only records where the channel is now -- otherwise switching the bridge
on would have broadcast the entire backlog to every client at once.

Re-delivery is harmless: the panel keys each announcement by its Discord
message id and refuses a second copy, so a retry, a reconnect, or a
catch-up that overlaps cannot broadcast twice.

The one thing to know: **posts made while the bot is not running only
arrive when it starts again.** For same-day delivery it wants to be
somewhere always-on rather than on a desktop that sleeps.

## Running it somewhere always-on

The bridge only works while the process is running, so a desktop that
sleeps is the wrong home for it. Two shapes of host, and they differ in
one way that matters.

**A plain server** -- a VM, a spare machine, a Raspberry Pi -- wants
`bot/.env` on disk and something to keep the process up. systemd with
`Restart=always` covers a crash and a reboot both.

**A container host** -- Back4App, Koyeb, Render -- builds `bot/Dockerfile`
instead. Set the service's root directory to `bot`, leave `.env` out of it
entirely, and set the same variables in the host's dashboard: an image is
readable by anyone who can reach the registry, and this one would
otherwise carry a live admin API key. `.dockerignore` keeps `.env` out of
the build context so it cannot be baked in by accident.

Those hosts also health-check an HTTP port and kill whatever does not
answer, which a Discord bot otherwise never would -- it dials out and
listens for nothing. Set `PORT` and the bot serves one line on it to be
seen alive. A plain server sets no `PORT` and no listener starts.

**A container loses its disk on every restart, and that costs the
catch-up.** `.announce-state.json` goes with it, so each start looks like
a first run: the bot re-arms at wherever the channel is now. Posts made
while it was down are skipped rather than delivered late, silently. On a
plain server the mark survives and they arrive. Worth knowing before
choosing a container host for something clients depend on.

## UID whitelist

`/uid ...` drives TERMINALX999's UID bypass list -- the same list the web
panel's *UID Bypass* section shows, so a UID added from Discord appears
there and vice versa.

It used to be a service of its own, on its own host with its own reseller
key. **That host no longer resolves.** The whitelist is now three actions
on the licence API above -- `whitelist_uid`, `remove_uid` and
`get_whitelisted_uids` -- reached by JSON POST with the same admin key.

| Variable | Meaning |
|---|---|
| `TX999_API_KEY` | Leave unset. Falls back to `LICENSE_API_KEY` |
| `TX999_API_URL` | Leave unset. Falls back to `LICENSE_API_URL` |
| `TX999_USER` / `TX999_PASS` | Dead. Nothing reads them -- see below |

The two `TX999_*` overrides exist only in case the provider splits the
services apart again. **Clear any value left from before the move**: it
beats the fallback and the new endpoint rejects it, in `bot/.env` and in a
container host's dashboard alike.

### What the provider actually does

There is still no update call and no bulk delete, which is why there is
no `/uid edit`. What changed in behaviour, not just in spelling:

- **The name is verified now.** The provider looks the UID up in the game,
  refuses one it cannot find, and answers with the real in-game name. The
  old service stored any name against any number. So `/uid add` reports a
  **Player** read off the account, and your own label moved to `note`.
- **Region is real.** The old service ignored it and reported `ALL SERVER`
  for everything. `/uid add` now offers IND, BD, BR, SG, RU, ID, TW, US, VN
  and PK as choices, defaulting to IND. A wrong region still spends a
  credit, which is why it is a choice list rather than free text.
- **Removal distinguishes absent from removed.** A UID the provider does
  not hold answers `404`, so `/uid remove` says "was not on the whitelist"
  or "removed from the whitelist" and means the difference. The old
  service reported success either way, which is why the command used to
  claim only the state now.
- **UIDs may be as short as 6 digits**, down from 8.
- **`message` is filled on success too.** Only `success` decides. The bot
  reads `message` only on the failure branch for that reason.
- **The record is read field by field.** The whitelist shares an endpoint,
  and a credential, with the licence API now -- a reply built from a whole
  record is one new upstream field away from printing something privileged
  into Discord.

Validity is `days`, from 1 to 30, defaulting to 30 when omitted. That cap
is this panel's pricing, not the API's; keep it in step with
`MAX_WHITELIST_DAYS` in `lib/packages.ts`.

### Why `/uid credits` reports nothing

There is no balance call left to make. `get_my_api_key` belonged to the
retired service, and `api_admin.php` answers an invalid-action error that
lists its entire vocabulary -- not something to print into a channel.
`reseller_stats`, which the endpoint does offer, counts licence keys and
not whitelist credits, so reporting it here would put a confident wrong
number in front of whoever is deciding how many UIDs they can still sell.

So the command says so and points at the provider's portal. `TX999_USER`
and `TX999_PASS` are left in `.env` as a marker rather than deleted, so
this can come back cheaply if a balance action ever appears.

## Validity: send it as `days`, and ignore `key_info`

The provider honours the validity, but only under the name it documents.
Sending it as `duration` -- which this project did until 28/08/2026 -- is
silently ignored, and the provider applies its own default instead: a key
asked for as 10 days turned up in their portal as 30. Sent as `days` it is
honoured, confirmed with 7 and 45.

The same applies to the quantity. It is `count`, not `amount`; an unread
name falls back to one, so every request for several keys returned exactly
one and reported success.

`key_info` cannot be used to check any of this. It answers
`duration_days: 0` and `expiry_date: "Never (Lifetime)"` for every unused
key regardless of what was applied, contradicting the provider's own
portal, which shows the correct number beside "On First Use". So the
requested value is what gets displayed, and the API's answer is used only
when it is a genuine date.

Ruled out along the way, against the live API: fifteen spellings of a
duration parameter in one request; a lifetime switch (`is_lifetime`,
`expiry_type` and ten more) alongside a number; an explicit end date in
seven spellings; and the same over JSON. All of those pre-date the
discovery that the name is simply `days`.
