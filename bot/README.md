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

`/genkey` posts to the channel so the server has a record; everything else
answers privately.

The buttons under a generated key keep working after a restart. They carry
the key in their `custom_id` and are handled by a global listener rather
than a view object, which would die with the process.

## Known limitation: `days` does nothing

`days` is sent under the name the provider documents, and the provider
ignores it. Two keys were minted moments apart, one with `days: 10` and one
with `days: 0`. The provider's portal listed **both as 30 days**.

Three sources, no two agreeing:

| Source | Says |
| --- | --- |
| what was requested | 10 days / 0 days |
| `key_info` | `duration_days: 0`, `expiry_date: "Never (Lifetime)"` |
| the provider's portal | `On First Use (30d)` for both |

Ruled out first, against the live API: fifteen spellings of a duration
parameter in one request; a lifetime switch (`is_lifetime`, `expiry_type`
and ten more) alongside a number; an explicit end date in seven spellings;
and the same over JSON. Every one returned lifetime. There is no action
that can change a key's expiry afterwards -- the supported list is
`generate_key, reset_hwid, ban_key, unban_key, delete_key, key_info,
reseller_stats, get_admin_packages` plus Discord/free-panel actions.

The "On First Use" wording suggests a key has no expiry until it is
claimed, and that `key_info` reports that empty column as lifetime. Either
way its answer cannot be repeated as fact for an unused key, so neither
`/genkey` nor the web panel states a validity it cannot stand behind.

Making `days` work needs a change on the provider's side. It is still sent,
so it starts working the moment they honour it.

