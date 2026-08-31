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


@bot.event
async def on_ready():
    log.info("Logged in as %s (id %s)", bot.user.name, bot.user.id)
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


def may_announce(author) -> bool:
    """
    Whether this person may broadcast to every client.

    Worth checking rather than assuming: anyone who can type in the channel
    would otherwise be sending a notice to every paying customer.
    """
    if ANNOUNCE_ALLOWED_IDS:
        held = {author.id} | {role.id for role in getattr(author, "roles", ())}
        return bool(held & ANNOUNCE_ALLOWED_IDS)
    perms = getattr(author, "guild_permissions", None)
    return bool(perms and (perms.manage_messages or perms.administrator))


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
    if not may_announce(message.author):
        log.warning("Ignored a post by %s: not allowed to broadcast.", message.author)
        return

    if await forward(message):
        advance_mark(message.id)
    else:
        mark_failed(message.id)


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
        newest = [m async for m in channel.history(limit=1)]
        if newest:
            write_mark(newest[0].id)
        log.info(
            "Bridge armed on #%s. Posts already there are left alone; the next one goes out.",
            channel.name,
        )
        return

    missed = [
        m
        async for m in channel.history(limit=50, after=discord.Object(id=mark), oldest_first=True)
    ]

    sent = 0
    for message in missed:
        if message.author.bot or message.webhook_id or not may_announce(message.author):
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


if __name__ == "__main__":
    bot.run(TOKEN)
