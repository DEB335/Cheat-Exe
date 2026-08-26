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

import os
import logging

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
    days="Validity in days. NOTE: the licence API currently ignores this and issues every key as lifetime.",
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
    # Say so rather than let someone believe the days field did something.
    embed.add_field(name="Expiry", value=data.get("expiry_date", "Never (Lifetime)"), inline=True)
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
