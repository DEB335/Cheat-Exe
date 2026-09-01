# The bot alone. The Next.js panel in this repository is deployed
# separately on Vercel and has no part in this image -- set the host's
# root directory to `bot` so the build context is this folder.
FROM python:3.12-slim

# Log lines have to reach the host's log view as they happen. Python
# buffers stdout when it is not a terminal, and on a container host
# that log view is the only window into the bot there is.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies in their own layer, before the code. They change far
# less often than bot.py does, so an edit rebuilds in seconds instead
# of reinstalling discord.py every time.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py .

# No .env is copied in, and .dockerignore keeps it out of the build
# context entirely. Secrets are set as environment variables in the
# host's dashboard: an image is a file that anyone who can reach the
# registry can read, and this one would otherwise carry a live admin
# API key. python-dotenv finds no file and falls through to the real
# environment, which is exactly what is wanted here.
CMD ["python", "bot.py"]
