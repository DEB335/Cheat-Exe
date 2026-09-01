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
| `/uid add uid days name` | Whitelists a UID for the bypass, posted publicly |
| `/uid remove uid` | Takes a UID off the whitelist |
| `/uid list` | Shows the whitelist with expiry and days left |
| `/uid credits` | TERMINALX999 credit balance |

`/genkey` and `/uid add` post to the channel so the server has a record;
everything else answers privately.

The `/uid` commands appear only when `TX999_API_KEY` is set. They talk to
a different service from the rest -- see below.

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

## UID whitelist

`/uid ...` drives TERMINALX999's UID bypass list -- **a different service
from the licence API above**, on its own host with its own key. It is the
same list the web panel's *UID Bypass* section shows, so a UID added from
Discord appears there and vice versa.

| Variable | Meaning |
|---|---|
| `TX999_API_KEY` | The reseller key. Blank leaves the `/uid` commands unregistered |
| `TX999_API_URL` | Defaults to `https://terminalx999.live/api.php` |
| `TX999_USER` / `TX999_PASS` | Optional, only for `/uid credits` |

Use the same `TX999_API_KEY` as the panel's `.env.local` so both write to
one list.

### What the provider actually does

Three actions exist -- `reseller_add`, `reseller_remove`, `reseller_list`.
Everything else answers "Method not allowed" or an empty 200 body. There
is no update call and no bulk delete, which is why there is no `/uid edit`.

Four behaviours are worth knowing, because each one contradicts what the
API looks like it does:

- **The name is not verified.** `name` is stored exactly as typed. A UID
  belonging to nobody is accepted just as readily as a real one, so the
  field is a label for your own records, not a check.
- **Region cannot be set.** `region`, `server` and `region_code` are all
  ignored; every entry comes back as `ALL SERVER`.
- **Removal always reports success**, whether or not the UID was ever on
  the list. `/uid remove` therefore says the UID *is not* whitelisted,
  never that it deleted something.
- **`reseller_list` echoes the API key back** in an `api_key_ref` field on
  every record. The bot reads records field by field for that reason -- a
  reply built from a whole record would print a live credential into
  Discord.

Validity is `days`, from 1 to 30, defaulting to 30 when omitted.

### Why `/uid credits` needs a username and password

The provider has no way to report a balance from the API key. Its
`get_my_api_key` is the *login* call that hands the key out, so it wants
an account: sent a key instead, it answers "Username and password are
required". Leave `TX999_USER` and `TX999_PASS` blank and the command says
so. It will not report a balance it cannot read.

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
