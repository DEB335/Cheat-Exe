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

The `days` option is sent, but the licence API ignores it and issues every
key as lifetime. This was verified directly against the live API: JSON body
with `days`, form body with `days`, and JSON with `duration` all returned
`"expiry_date": "Never (Lifetime)", "duration_days": 0`. There is also no
`set_expiry` action -- the supported list is `generate_key, reset_hwid,
ban_key, unban_key, delete_key, key_info, reseller_stats,
get_admin_packages` plus Discord/free-panel actions.

Making keys expire needs a change on the provider's side. The option is
kept so it starts working the moment they honour it, and `/genkey` shows
the real expiry the API reports rather than the value that was asked for.
