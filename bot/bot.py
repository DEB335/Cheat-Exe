"""
CHEAT EXE licence bot for Discord.

Slash commands that drive the same TERMINALX999 admin API the web panel
uses, so keys issued here show up there and vice versa.

Credentials come from the environment, never from this file: the API key
is a live admin credential and this repository is shared. Copy
.env.example to .env and fill it in.

    pip install -r requirements.txt
    python bot.py
"""

import asyncio
import json
import logging
import os
import re
from datetime import date, datetime, timezone
from pathlib import Path

import discord
import requests
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s")
log = logging.getLogger("cheatexe-bot")

TOKEN = os.environ.get("DISCORD_TOKEN", "")
GUILD_ID = int(os.environ.get("DISCORD_GUILD_ID", "0") or 0)

API_URL = os.environ.get("LICENSE_API_URL", "https://auth.terminalx999.online/api_admin.php")
API_KEY = os.environ.get("LICENSE_API_KEY", "")
APP_ID = os.environ.get("LICENSE_APP_ID", "")

# ---------------------------------------------------------------------------
# TERMINALX999 UID whitelist.
#
# It used to be a service of its own -- terminalx999.live/api.php, a GET
# with query parameters, its own reseller key, its own reseller_* actions.
# That host no longer resolves. The whitelist is now three actions on the
# licence API's own endpoint, reached with the same admin key, so TX999_*
# fall back to LICENSE_* rather than asking for a second copy of one key.
#
# Which means the /uid commands now register whenever the licence API is
# configured at all: same endpoint, same credential, nothing extra to set.
# TX999_* stay readable only in case the provider splits the two again.
# ---------------------------------------------------------------------------

WHITELIST_API_URL = os.environ.get("TX999_API_URL") or API_URL
WHITELIST_API_KEY = os.environ.get("TX999_API_KEY") or API_KEY

# The credential that /credits used to sign in with. The action it called,
# get_my_api_key, belonged to the retired service and the admin API does
# not offer it, so nothing reads these now -- see uid_credits. Kept as a
# named pair so the .env files and this module still agree about what was
# there, and so restoring the command is a small change if the provider
# ever adds a balance action.
WHITELIST_USER = os.environ.get("TX999_USER", "")
WHITELIST_PASS = os.environ.get("TX999_PASS", "")

# True in every configured deployment now: the whitelist shares the licence
# key, and startup already refuses to run without one. The guard stays for
# the day that stops being true rather than for today.
WHITELIST_ON = bool(WHITELIST_API_KEY)

# This panel's cap, not the provider's: the API takes longer runs (and 0
# for lifetime). Raising it is a pricing decision. Keep it in step with
# MAX_WHITELIST_DAYS in lib/packages.ts, which the web form enforces.
MAX_WHITELIST_DAYS = 30

# The server regions the provider accepts. Offered as choices rather than
# free text: it bills the add whether or not it recognised the region, so
# a typo is a spent credit on an entry pointed at the wrong servers.
WHITELIST_REGIONS = [
    ("India (IND)", "IND"),
    ("Bangladesh (BD)", "BD"),
    ("Brazil (BR)", "BR"),
    ("Singapore (SG)", "SG"),
    ("Russia (RU)", "RU"),
    ("Indonesia (ID)", "ID"),
    ("Taiwan (TW)", "TW"),
    ("United States (US)", "US"),
    ("Vietnam (VN)", "VN"),
    ("Pakistan (PK)", "PK"),
]
DEFAULT_WHITELIST_REGION = "IND"

# Fail loudly at startup rather than with a confusing API error later.
_missing = [
    name
    for name, value in (
        ("DISCORD_TOKEN", TOKEN),
        ("DISCORD_GUILD_ID", GUILD_ID),
        ("LICENSE_API_KEY", API_KEY),
        ("LICENSE_APP_ID", APP_ID),
    )
    if not value
]
if _missing:
    raise SystemExit(f"Missing required environment variables: {', '.join(_missing)}")

# ---------------------------------------------------------------------------
# Discord -> panel announcement bridge
#
# A post in #client-announcement becomes an announcement on every client's
# dashboard, so a notice is written once instead of twice. Entirely
# optional: leave these unset and the bot behaves exactly as it did before.
# ---------------------------------------------------------------------------

# By id, never by name. The server has a second announcements channel under
# the regulation category, names can be changed, and two channels in
# different categories may even share one -- an id can do none of that.
ANNOUNCE_CHANNEL_ID = int(os.environ.get("ANNOUNCE_CHANNEL_ID", "0") or 0)
PANEL_INGEST_URL = os.environ.get("PANEL_INGEST_URL", "")
BRIDGE_SECRET = os.environ.get("DISCORD_BRIDGE_SECRET", "")


def _id_set(raw: str) -> set:
    return {int(part) for part in re.split(r"[,\s]+", raw.strip()) if part.isdigit()}


# Who may broadcast. Empty means anyone who can moderate the channel, which
# is what an announcements channel normally limits posting to anyway. Set it
# to role or user ids to say so explicitly instead.
ANNOUNCE_ALLOWED_IDS = _id_set(os.environ.get("ANNOUNCE_ALLOWED_IDS", ""))

BRIDGE_ON = bool(ANNOUNCE_CHANNEL_ID and PANEL_INGEST_URL and BRIDGE_SECRET)

# Container hosts -- Back4App, Koyeb, Render and the like -- health-check
# an HTTP port and kill whatever does not answer on it. A Discord bot has
# no web surface to offer them: it dials out to the gateway and listens
# for nothing. So when the host names a port, serve one line on it purely
# to be seen alive. A plain server sets no PORT and none of this runs.
PORT = int(os.environ.get("PORT", "0") or 0)
_health_started = False

# Newest message already forwarded. Kept on disk so a restart neither
# replays the channel nor loses what was posted while the bot was down.
STATE_PATH = Path(__file__).with_name(".announce-state.json")

# Lowest id that failed to deliver. The mark never advances past it, so a
# blip that drops one message cannot strand it behind later successes --
# the next catch-up reads from the mark and picks it up again.
_stuck_at = None

# Package ids, matching lib/packages.ts in the web panel. Keep the two in
# step: a package added upstream has to be listed in both to be usable.
PACKAGES = [
    ("BASIC PANEL", "e52c1515c53453b85d0d4e87"),
    ("AIMSILENT EXE", "affc8da8fd5ace99981ab877"),
    ("UID BYPASS", "cb921031dc43197e8ccb6828"),
    ("EXTERNAL PANEL", "3d1c6c948b4715fbd2fada2d"),
    ("PVT AIMKILL", "d4f0ce93349f236711344cb5"),
    ("VAULT PANEL", "154d1edaddd7203fbfd847f4"),
    ("LIB BYPASS", "db3b90e8134ec738b94a9b05"),
]

BRAND = 0xE8A020
ACTIONS = ("reset_hwid", "ban_key", "unban_key", "delete_key")

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


def call_api(action: str, **params) -> dict:
    """One entry point to the licence API, so the key is attached in one place."""
    payload = {"api_key": API_KEY, "action": action, **params}
    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        return response.json()
    except requests.Timeout:
        return {"success": False, "message": "The licence API did not respond in time."}
    except Exception as err:  # noqa: BLE001 - surfaced to the user, never raised
        return {"success": False, "message": f"Could not reach the licence API: {err}"}


def call_whitelist(action: str, **params) -> dict:
    """
    One entry point to the UID whitelist.

    A JSON POST to the licence API's own endpoint now -- the same shape as
    call_api, kept separate only so the whitelist key stays swappable if
    the provider splits the two services again. Three actions exist:
    whitelist_uid, remove_uid and get_whitelisted_uids.

    The HTTP status comes back as `_status`. This endpoint answers 404 for
    a UID it does not hold, and that is the one failure a caller treats as
    an outcome rather than an error.

    Note that `message` is filled on success too ("Whitelisted UIDs
    retrieved successfully."), so only `success` decides -- read it as the
    retired service's `error` was read and every good reply looks broken.
    """
    payload = {"api_key": WHITELIST_API_KEY, "action": action, **params}
    try:
        response = requests.post(
            WHITELIST_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        data = response.json()
        status = response.status_code
    except requests.Timeout:
        return {"success": False, "message": "The whitelist API did not respond in time."}
    except Exception as err:  # noqa: BLE001 - surfaced to the user, never raised
        return {"success": False, "message": f"Could not reach the whitelist API: {err}"}

    if not isinstance(data, dict):
        return {"success": False, "message": "The whitelist API sent an unreadable reply."}
    # The retired service named its failure field `error`. Still read, so a
    # half-migrated deployment reports the real reason rather than nothing.
    if "message" not in data and "error" in data:
        data["message"] = data["error"]
    data["_status"] = status
    return data


def clean_uid(raw: str):
    """The provider's own rule, applied here so a bad UID costs no credit."""
    uid = raw.strip()
    return uid if uid.isdigit() and len(uid) >= 6 else None


def authorised(interaction: discord.Interaction) -> bool:
    return interaction.guild_id == GUILD_ID


def key_controls(key: str) -> discord.ui.View:
    """
    Buttons that keep working after a restart.

    The view has no timeout and no callbacks of its own -- the ids carry
    the key, and on_interaction below handles them. A view rebuilt in
    memory would stop responding the moment the process restarted.
    """
    view = discord.ui.View(timeout=None)
    view.add_item(discord.ui.Button(label="Reset HWID", style=discord.ButtonStyle.secondary, emoji="\U0001F504", custom_id=f"reset_hwid:{key}"))
    view.add_item(discord.ui.Button(label="Ban Key", style=discord.ButtonStyle.danger, emoji="\U0001F6AB", custom_id=f"ban_key:{key}"))
    view.add_item(discord.ui.Button(label="Delete Key", style=discord.ButtonStyle.danger, emoji="❌", custom_id=f"delete_key:{key}"))
    return view


async def start_health_server() -> None:
    """
    Answers the host's health check, and nothing else.

    aiohttp is already here as one of discord.py's own dependencies, so
    this costs no extra install. Guarded because on_ready runs again on
    every reconnect and the port is only free the first time.
    """
    global _health_started
    if not PORT or _health_started:
        return

    from aiohttp import web

    async def handler(_request):
        return web.Response(text="ok" if bot.is_ready() else "starting")

    app = web.Application()
    app.router.add_get("/", handler)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()

    _health_started = True
    log.info("Health endpoint listening on port %d.", PORT)


@bot.event
async def on_ready():
    log.info("Logged in as %s (id %s)", bot.user.name, bot.user.id)
    await start_health_server()
    try:
        synced = await bot.tree.sync()
        log.info("Synced %d slash command(s)", len(synced))
    except Exception as err:  # noqa: BLE001
        log.error("Failed to sync commands: %s", err)

    # Safe to repeat: on_ready fires again after a reconnect, and the mark
    # plus the panel's own duplicate check make a second pass a no-op.
    await catch_up()


# ---------------------------------------------------------------------------
# Announcement bridge
# ---------------------------------------------------------------------------


def read_mark():
    """Newest message already forwarded, or None before the first run."""
    try:
        with open(STATE_PATH, encoding="utf-8") as handle:
            return int(json.load(handle)["last_id"])
    except Exception:  # noqa: BLE001 - a missing or damaged file means "unset"
        return None


def write_mark(message_id: int) -> None:
    """Stored as a string: ids run past what some JSON readers keep exact."""
    try:
        with open(STATE_PATH, "w", encoding="utf-8") as handle:
            json.dump({"last_id": str(message_id)}, handle)
    except OSError as err:
        log.warning("Could not save the announcement mark: %s", err)


def advance_mark(message_id: int) -> None:
    if _stuck_at is not None and message_id >= _stuck_at:
        return
    write_mark(message_id)


def mark_failed(message_id: int) -> None:
    global _stuck_at
    if _stuck_at is None or message_id < _stuck_at:
        _stuck_at = message_id


def may_announce(message) -> bool:
    """
    Whether this post should go out to every client.

    ANNOUNCE_ALLOWED_IDS narrows it to named roles or users. Left blank,
    the channel decides: whoever Discord lets write here may broadcast.

    That is the gate someone actually maintains. #client-announcement
    denies Send to @everyone and to the Client role and names the few who
    may post, so a client can read it but not write to it. Requiring
    Manage Messages on top of that looked stricter and was really just a
    second, different rule -- Founder can post there and holds neither
    Manage Messages nor Administrator, so those posts were dropped with
    nothing to show for it but a line in a log nobody reads.
    """
    author = message.author
    if ANNOUNCE_ALLOWED_IDS:
        held = {author.id} | {role.id for role in getattr(author, "roles", ())}
        return bool(held & ANNOUNCE_ALLOWED_IDS)

    # History can hand back a plain User. The overwrites are written
    # against roles, so resolve it to the member that carries them.
    if not hasattr(author, "roles") and message.guild is not None:
        author = message.guild.get_member(author.id) or author
    try:
        return bool(message.channel.permissions_for(author).send_messages)
    except (AttributeError, TypeError):
        # Unresolvable member: decline rather than guess, and say so.
        log.warning("Could not resolve %s against the channel; post ignored.", author)
        return False


def announcement_body(message: discord.Message) -> str:
    """
    The text as a client should read it.

    clean_content rather than content, so a mention arrives as a readable
    name instead of a raw id. Attachments are appended as links because the
    panel stores plain text -- without them an image-only post would turn
    up blank.
    """
    parts = [message.clean_content.strip()]
    parts.extend(attachment.url for attachment in message.attachments)
    return "\n".join(part for part in parts if part)


def post_announcement(body: str, author: str, message_id: int) -> dict:
    """Blocking, like call_api. Callers run it off the event loop."""
    try:
        response = requests.post(
            PANEL_INGEST_URL,
            json={"body": body, "author": author, "discordId": str(message_id)},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BRIDGE_SECRET}",
            },
            timeout=20,
        )
        return response.json()
    except requests.Timeout:
        return {"success": False, "message": "The panel did not respond in time."}
    except Exception as err:  # noqa: BLE001 - logged, never raised
        return {"success": False, "message": f"Could not reach the panel: {err}"}


def delete_announcement(message_id: int) -> dict:
    """Blocking, like post_announcement. Callers run it off the event loop."""
    try:
        response = requests.delete(
            PANEL_INGEST_URL,
            params={"discordId": str(message_id)},
            headers={"Authorization": f"Bearer {BRIDGE_SECRET}"},
            timeout=20,
        )
        return response.json()
    except requests.Timeout:
        return {"success": False, "message": "The panel did not respond in time."}
    except Exception as err:  # noqa: BLE001 - logged, never raised
        return {"success": False, "message": f"Could not reach the panel: {err}"}


async def withdraw(message_id: int) -> None:
    """
    Takes one deleted post back off the panel.

    Quiet when there was nothing to remove: most deletions in the channel
    are of posts that were never forwarded in the first place.
    """
    data = await asyncio.to_thread(delete_announcement, message_id)
    if not data.get("success"):
        log.error(
            "Announcement %s could not be withdrawn: %s",
            message_id,
            data.get("message", "unknown error"),
        )
    elif data.get("removed"):
        log.info("Announcement %s withdrawn from every client.", message_id)


async def forward(message: discord.Message) -> bool:
    """Sends one message to the panel. True once it is safely recorded."""
    body = announcement_body(message)
    if not body:
        log.info("Announcement %s has nothing to forward.", message.id)
        return True

    author = getattr(message.author, "display_name", str(message.author))
    # requests blocks; kept off the loop so the gateway heartbeat keeps time.
    data = await asyncio.to_thread(post_announcement, body, author, message.id)

    if data.get("success"):
        if data.get("duplicate"):
            log.info("Announcement %s was already on the panel.", message.id)
        else:
            log.info("Announcement %s sent to every client.", message.id)
        if data.get("truncated"):
            log.warning("Announcement %s was longer than the panel allows and was cut.", message.id)
        return True

    log.error(
        "Announcement %s was not delivered: %s",
        message.id,
        data.get("message", "unknown error"),
    )
    return False


@bot.event
async def on_message(message: discord.Message):
    # First and unconditionally: defining on_message replaces the default
    # handler, and without this the prefix commands stop being processed.
    await bot.process_commands(message)

    if not BRIDGE_ON:
        return
    # The one channel, by id. The regulation announcements channel has a
    # different id and never gets past this line -- and neither do threads
    # started under this one, which each carry an id of their own.
    if message.channel.id != ANNOUNCE_CHANNEL_ID:
        return
    # Ourselves, other bots, and webhook posts. That last one matters if
    # this is an Announcement channel: content crossposted in from a
    # followed server arrives as a webhook and is not ours to broadcast.
    if message.author.bot or message.webhook_id:
        return
    if not may_announce(message):
        log.warning("Ignored a post by %s: not allowed to broadcast.", message.author)
        return

    if await forward(message):
        advance_mark(message.id)
    else:
        mark_failed(message.id)


@bot.event
async def on_raw_message_delete(payload: discord.RawMessageDeleteEvent):
    """
    A post taken back in Discord is taken back on the panel.

    Raw rather than on_message_delete, which only fires for messages the
    bot still holds in memory -- after a restart that is none of them, and
    a notice that has been up a while is exactly the one somebody wants
    withdrawn. The raw event always arrives, cached or not.
    """
    if not BRIDGE_ON or payload.channel_id != ANNOUNCE_CHANNEL_ID:
        return
    await withdraw(payload.message_id)


@bot.event
async def on_raw_bulk_message_delete(payload: discord.RawBulkMessageDeleteEvent):
    """A purge is the same event many times over; Discord sends it once."""
    if not BRIDGE_ON or payload.channel_id != ANNOUNCE_CHANNEL_ID:
        return
    for message_id in payload.message_ids:
        await withdraw(message_id)


async def read_history(channel, **kwargs):
    """
    A page of channel history, or None when the bot may not read it.

    Being in the server is not the same as being let into this channel:
    #client-announcement denies @everyone and names the roles that may
    look, so the bot needs its own overwrite there. Without one every read
    comes back 403, and unhandled that surfaces as a traceback out of
    on_ready rather than something anyone can act on.
    """
    try:
        return [m async for m in channel.history(**kwargs)]
    except discord.Forbidden:
        log.error(
            "Cannot read #%s. Give the bot View Channel and Read Message History "
            "on that channel -- a channel overwrite, since @everyone is denied there.",
            getattr(channel, "name", ANNOUNCE_CHANNEL_ID),
        )
        return None


async def catch_up():
    """
    Forwards anything posted while the bot was offline.

    On the very first run it only records where the channel is now. Without
    that, switching the bridge on would broadcast the channel's whole
    backlog to every client at once.
    """
    global _stuck_at

    if not BRIDGE_ON:
        log.info(
            "Announcement bridge is off. Set ANNOUNCE_CHANNEL_ID, PANEL_INGEST_URL "
            "and DISCORD_BRIDGE_SECRET to turn it on."
        )
        return

    channel = bot.get_channel(ANNOUNCE_CHANNEL_ID)
    if channel is None:
        log.error(
            "Announcement channel %s not found. Is the bot in that server, and can it "
            "read the channel?",
            ANNOUNCE_CHANNEL_ID,
        )
        return

    # About to re-read from the mark, which is where anything stuck still is.
    _stuck_at = None

    mark = read_mark()
    if mark is None:
        newest = await read_history(channel, limit=1)
        # Leave the mark unset rather than arming on a channel that cannot
        # be read: the next start retries instead of silently deciding the
        # channel is empty and skipping everything already in it.
        if newest is None:
            return
        if newest:
            write_mark(newest[0].id)
        log.info(
            "Bridge armed on #%s. Posts already there are left alone; the next one goes out.",
            channel.name,
        )
        return

    missed = await read_history(
        channel, limit=50, after=discord.Object(id=mark), oldest_first=True
    )
    if missed is None:
        return

    sent = 0
    for message in missed:
        if message.author.bot or message.webhook_id or not may_announce(message):
            advance_mark(message.id)
            continue
        if not await forward(message):
            # The panel is unreachable; stop rather than burn through the
            # rest, and leave the mark where the next start can resume.
            mark_failed(message.id)
            break
        advance_mark(message.id)
        sent += 1

    if sent:
        log.info("Forwarded %d announcement(s) posted while offline.", sent)


@bot.event
async def on_interaction(interaction: discord.Interaction):
    """Handles the persistent key buttons, which outlive the view objects."""
    if interaction.type != discord.InteractionType.component:
        return

    custom_id = (interaction.data or {}).get("custom_id", "")
    if ":" not in custom_id:
        return

    action, key = custom_id.split(":", 1)
    if action not in ACTIONS:
        return

    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    data = call_api(action, key=key)
    if data.get("success"):
        await interaction.followup.send(f"✓ **{action}** applied to `{key}`", ephemeral=True)
    else:
        await interaction.followup.send(f"❌ {data.get('message', 'Action failed.')}", ephemeral=True)


@bot.tree.command(name="genkey", description="Generate a licence key.")
@discord.app_commands.choices(
    package=[discord.app_commands.Choice(name=name, value=pid) for name, pid in PACKAGES]
)
@discord.app_commands.describe(
    package="Which package the key unlocks",
    days="Validity in days (0 for lifetime)",
    count="How many keys to generate (1-100)",
)
async def genkey(interaction: discord.Interaction, package: str, days: int = 30, count: int = 1):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    if not 1 <= count <= 100:
        await interaction.response.send_message("Count must be between 1 and 100.", ephemeral=True)
        return

    # Public on purpose: the channel is the record of what was issued.
    await interaction.response.defer(ephemeral=False)

    data = call_api(
        "generate_key",
        app_id=APP_ID,
        package_id=package,
        days=days,
        count=count,
    )

    if not data.get("success"):
        await interaction.followup.send(f"❌ {data.get('message', 'Failed to generate key.')}")
        return

    keys = data.get("keys") or ([data["key"]] if data.get("key") else [])
    if not keys:
        await interaction.followup.send("❌ The API reported success but returned no keys.")
        return

    package_name = data.get("package_name") or next((n for n, p in PACKAGES if p == package), package)
    listing = "\n".join(f"`{k}`" for k in keys)

    embed = discord.Embed(
        title=f"\U0001F511 {len(keys)} key{'' if len(keys) == 1 else 's'} generated",
        description=f"Package: **{package_name}**\n\n{listing}",
        color=BRAND,
    )
    # The provider honours `days`, so the requested value is the real one.
    # Its key_info is not: it calls every unused key lifetime whatever was
    # applied, contradicting the provider's own portal. So a genuine date
    # is used if one ever appears, and otherwise what was asked for.
    reported = data.get("expiry_date") or ""
    if reported and "lifetime" not in reported.lower() and "never" not in reported.lower():
        expiry = reported
    else:
        expiry = "Lifetime" if days == 0 else f"{days} days"
    embed.add_field(name="Expiry", value=expiry, inline=True)
    embed.add_field(name="Issued by", value=interaction.user.mention, inline=True)
    embed.set_footer(text="CHEAT EXE - licence automation")

    # Controls only make sense when they can target one key.
    view = key_controls(keys[0]) if len(keys) == 1 else None
    await interaction.followup.send(embed=embed, view=view)


async def _key_action(interaction: discord.Interaction, action: str, key: str, done: str):
    """Shared body for the four single-key commands."""
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    key = key.strip()
    if not key:
        await interaction.response.send_message("Enter a licence key.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    data = call_api(action, key=key)
    if data.get("success"):
        await interaction.followup.send(f"✓ {done}: `{key}`", ephemeral=True)
    else:
        await interaction.followup.send(f"❌ {data.get('message', 'Action failed.')}", ephemeral=True)


@bot.tree.command(name="reset", description="Reset the HWID lock on a licence key.")
@discord.app_commands.describe(key="The licence key to reset")
async def reset_key(interaction: discord.Interaction, key: str):
    await _key_action(interaction, "reset_hwid", key, "HWID reset")


@bot.tree.command(name="ban", description="Ban a licence key.")
@discord.app_commands.describe(key="The licence key to ban")
async def ban_key(interaction: discord.Interaction, key: str):
    await _key_action(interaction, "ban_key", key, "Key banned")


@bot.tree.command(name="unban", description="Unban a licence key.")
@discord.app_commands.describe(key="The licence key to unban")
async def unban_key(interaction: discord.Interaction, key: str):
    await _key_action(interaction, "unban_key", key, "Key unbanned")


@bot.tree.command(name="delete", description="Delete a licence key permanently.")
@discord.app_commands.describe(key="The licence key to delete")
async def delete_key(interaction: discord.Interaction, key: str):
    await _key_action(interaction, "delete_key", key, "Key deleted")


@bot.tree.command(name="info", description="Look up a licence key.")
@discord.app_commands.describe(key="The licence key to inspect")
async def key_info(interaction: discord.Interaction, key: str):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    data = call_api("key_info", key=key.strip())
    if not data.get("success"):
        await interaction.followup.send(f"❌ {data.get('message', 'Key not found.')}", ephemeral=True)
        return

    embed = discord.Embed(title=f"\U0001F50D {data.get('key', key)}", color=BRAND)
    for label, field in (
        ("Package", "package_name"),
        ("Application", "app_name"),
        ("Status", "status"),
        ("Created", "created_at"),
        ("Expiry", "expiry_date"),
        ("HWID", "hwid"),
        ("IP", "ip"),
    ):
        embed.add_field(name=label, value=str(data.get(field) or "—"), inline=True)
    await interaction.followup.send(embed=embed, view=key_controls(data.get("key", key)), ephemeral=True)


# ---------------------------------------------------------------------------
# UID whitelist
#
# The same list the panel's UID Bypass section shows. Registered only when
# TX999_API_KEY is set, so an unconfigured bot advertises no command it
# cannot carry out.
# ---------------------------------------------------------------------------

uid_group = discord.app_commands.Group(name="uid", description="TERMINALX999 UID whitelist.")


def expiry_day(entry: dict) -> str:
    """
    The expiry as "YYYY-MM-DD", whatever shape the provider sent it in.

    It sends `expires_at` as a unix timestamp in seconds. The retired
    service sent `expire_date` as a date string, and days_left below
    still parses that, so the timestamp is converted once here rather
    than taught to every caller. Anything unreadable becomes "", which
    displays as a dash instead of throwing.
    """
    value = entry.get("expires_at")
    if value in (None, ""):
        value = entry.get("expire_date") or entry.get("expiry_date")
    if value in (None, ""):
        return ""

    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
        seconds = float(value)
        if seconds <= 0:
            return ""
        # Seconds unless it is plainly milliseconds.
        if seconds > 1e11:
            seconds /= 1000
        try:
            return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y-%m-%d")
        except (OverflowError, OSError, ValueError):
            return ""

    return str(value)[:10]


def days_left(expire_date: str):
    """
    Whole days until an entry lapses, or None if the date is unreadable.

    The provider counts the expiry day itself as valid, so this compares
    dates rather than instants -- otherwise an entry would read as expired
    partway through a customer's last day.
    """
    try:
        year, month, day = (int(part) for part in expire_date.strip().split("-"))
        return (date(year, month, day) - date.today()).days
    except (ValueError, AttributeError):
        return None


@uid_group.command(name="add", description="Whitelist a UID.")
@discord.app_commands.describe(
    uid="The player UID, digits only",
    region="The server the account plays on",
    days=f"Validity in days (1-{MAX_WHITELIST_DAYS}, default {MAX_WHITELIST_DAYS})",
    note="A buyer reference for your own records",
)
@discord.app_commands.choices(
    region=[
        discord.app_commands.Choice(name=label, value=code)
        for label, code in WHITELIST_REGIONS
    ]
)
async def uid_add(
    interaction: discord.Interaction,
    uid: str,
    region: str = DEFAULT_WHITELIST_REGION,
    days: int = MAX_WHITELIST_DAYS,
    note: str = "",
):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    cleaned = clean_uid(uid)
    if cleaned is None:
        await interaction.response.send_message("UID must be digits only, at least 6.", ephemeral=True)
        return
    if not 1 <= days <= MAX_WHITELIST_DAYS:
        await interaction.response.send_message(
            f"Validity must be between 1 and {MAX_WHITELIST_DAYS} days.", ephemeral=True
        )
        return
    # Discord enforces the choices, but an out-of-date client can send
    # anything, and the provider bills the add either way.
    if region not in {code for _, code in WHITELIST_REGIONS}:
        await interaction.response.send_message(
            f"Unknown server region {region}.", ephemeral=True
        )
        return

    # Public on purpose, like /genkey: the channel is the record of what
    # was sold, and this spends a credit.
    await interaction.response.defer(ephemeral=False)

    label = note.strip()[:40]
    data = await asyncio.to_thread(
        call_whitelist,
        "whitelist_uid",
        uid=cleaned,
        region=region,
        days=days,
        note=label,
    )

    if not data.get("success"):
        await interaction.followup.send(f"\u274c {data.get('message', 'Could not whitelist that UID.')}")
        return

    embed = discord.Embed(
        title="\u2705 UID whitelisted",
        description=f"`{cleaned}`",
        color=BRAND,
    )
    # Read off the account rather than typed: the provider looks the UID
    # up in the game and refuses one it cannot find. The retired service
    # did the opposite, storing any name against any number, so this is
    # the field whose meaning changed rather than its spelling.
    record = data.get("data") or {}
    if isinstance(record, list):
        record = record[0] if record else {}
    if not isinstance(record, dict):
        record = {}
    # Top level first: whitelist_uid answers flat, where the list nests
    # its records under "data".
    player = data.get("name") or record.get("name") or ""
    expiry = expiry_day(record) or expiry_day(data)

    embed.add_field(name="Player", value=player or "\u2014", inline=True)
    embed.add_field(name="Region", value=region, inline=True)
    embed.add_field(name="Validity", value=f"{days} day{'' if days == 1 else 's'}", inline=True)
    embed.add_field(name="Expires", value=expiry or "\u2014", inline=True)
    embed.add_field(name="Note", value=label or "\u2014", inline=True)
    embed.add_field(name="Added by", value=interaction.user.mention, inline=True)
    embed.set_footer(text="CHEAT EXE - UID bypass")
    await interaction.followup.send(embed=embed)


@uid_group.command(name="remove", description="Remove a UID from the whitelist.")
@discord.app_commands.describe(uid="The UID to remove")
async def uid_remove(interaction: discord.Interaction, uid: str):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    cleaned = clean_uid(uid)
    if cleaned is None:
        await interaction.response.send_message("UID must be digits only, at least 6.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    data = await asyncio.to_thread(call_whitelist, "remove_uid", uid=cleaned)

    # A 404 is not a failure to remove: the provider does not hold the
    # UID, which is what was asked for. It is reported rather than
    # smoothed over, because "taken off the list" and "was never on it"
    # are different facts -- and the retired service, which answered
    # success to both, is why that distinction is worth printing.
    if data.get("_status") == 404:
        await interaction.followup.send(
            f"\U0001f5d1 `{cleaned}` was not on the whitelist.", ephemeral=True
        )
        return

    if not data.get("success"):
        await interaction.followup.send(f"\u274c {data.get('message', 'Removal failed.')}", ephemeral=True)
        return

    await interaction.followup.send(
        f"\U0001f5d1 `{cleaned}` removed from the whitelist.", ephemeral=True
    )


@uid_group.command(name="list", description="Show the whitelisted UIDs.")
async def uid_list(interaction: discord.Interaction):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    data = await asyncio.to_thread(call_whitelist, "get_whitelisted_uids")

    if not data.get("success"):
        await interaction.followup.send(
            f"\u274c {data.get('message', 'Could not read the list.')}", ephemeral=True
        )
        return

    entries = data.get("data") or []
    # The empty list is the only shape confirmed against the live API, so
    # anything else is refused rather than iterated into a TypeError.
    if not isinstance(entries, list):
        await interaction.followup.send(
            "The whitelist API sent a list in an unexpected shape.", ephemeral=True
        )
        return
    if not entries:
        await interaction.followup.send("The whitelist is empty.", ephemeral=True)
        return

    lines = []
    expired = 0
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        # Field by field, never the whole record. The whitelist shares an
        # endpoint with the licence API now, so a line built from a whole
        # record is one new upstream field away from printing something
        # privileged into Discord.
        entry_uid = str(entry.get("uid", "?"))
        entry_name = entry.get("name") or "\u2014"
        entry_region = entry.get("region") or "\u2014"
        expiry = expiry_day(entry)

        left = days_left(expiry)
        if left is None:
            state = ""
        elif left < 0:
            expired += 1
            state = " - expired"
        elif left == 0:
            state = " - expires today"
        else:
            state = f" - {left}d left"

        shown = expiry or "\u2014"
        lines.append(f"`{entry_uid}` {entry_name} [{entry_region}] \u2014 {shown}{state}")

    listing = "\n".join(lines)
    if len(listing) > 3900:
        listing = listing[:3900].rsplit("\n", 1)[0] + "\n\u2026"

    embed = discord.Embed(title="\U0001f4dc Whitelisted UIDs", description=listing, color=BRAND)
    embed.set_footer(text=f"{len(entries)} total - {expired} expired")
    await interaction.followup.send(embed=embed, ephemeral=True)


@uid_group.command(name="credits", description="Check the TERMINALX999 whitelist credits.")
async def uid_credits(interaction: discord.Interaction):
    if not authorised(interaction):
        await interaction.response.send_message("Not authorised in this server.", ephemeral=True)
        return

    # There is no balance call left to make.
    #
    # This used to sign in with get_my_api_key, which the retired service
    # offered and the admin API does not -- it answers an invalid-action
    # error listing its whole vocabulary, which is not something to print
    # into a channel. reseller_stats is the nearest thing the endpoint has
    # and it counts licence keys, not whitelist credits, so reporting it
    # here would put a confident wrong number in front of whoever is
    # deciding how many UIDs they can still sell.
    #
    # TX999_USER and TX999_PASS are no longer read anywhere. Left in the
    # .env files rather than deleted, so this can come back
    # cheaply if the provider adds a balance action.
    await interaction.response.send_message(
        "\U0001f4b3 The provider exposes no credit balance on this endpoint. "
        "Check the TERMINALX999 portal for the remaining whitelist credits.",
        ephemeral=True,
    )


if WHITELIST_ON:
    bot.tree.add_command(uid_group)
else:
    log.info("UID whitelist commands are off: no licence or TX999 API key is set.")


if __name__ == "__main__":
    bot.run(TOKEN)
