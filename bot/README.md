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
