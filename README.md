# Blueprint

Blueprint is a modular, dashboard-first Discord bot and control center.

This repository runs two connected surfaces in one Node process:

- the Discord bot
- the Blueprint website and dashboard

The product goal is a real server-control platform, not a pile of commands. Each major feature should feel like an installable module with its own settings, validation, permissions, and dashboard UI.

## Website Essentials

The web layer now includes the baseline public-site files and routes expected from a production website:

- `/privacy`
- `/terms`
- Contact is centralized at `https://contact.continental-hub.com`
- `/robots.txt`
- `/sitemap.xml`
- `/security.txt`
- `/.well-known/security.txt`
- `/site.webmanifest`
- a custom 404 page
- SEO and social metadata in the shared layout

These sit alongside the authenticated dashboard rather than being separate static mock pages.

## Core Product Shape

Blueprint is designed around:

- modular server features
- dashboard-first configuration
- per-server settings
- configurable enable/disable states
- clean operator UX

Examples of managed modules in this repo include:

- welcome flows
- auto roles
- countdowns
- audit log
- auto moderation
- announcements
- starboard
- suggestions
- reaction roles
- tickets
- leveling
- anti-raid
- automations
- modmail
- applications
- AI tools

Runtime notes:

- Modmail forwards member DMs to the configured inbox. Staff reply by replying to the forwarded Discord message; Blueprint sends that reply back to the member.
- The automation `Create ticket` action requires the Tickets module to be enabled and configured, and creates a real private ticket channel.
- Reaction roles currently support one configured role per reaction message.

## Slash Commands

Current slash commands:

- `/ping`
- `/hello`
- `/dashboard`
- `/countdown`
- `/ai`
- `/aireset`
- `/announce`
- `/suggest`
- `/apply`

Complex setup belongs in the website, not in oversized slash-command trees.

## Access Model

Blueprint uses the Continental ID auth flow for website access.

Users sign in with Continental ID, Blueprint reads the linked Discord identity from that authenticated profile, and the dashboard only exposes servers where:

- the bot is installed
- the linked Discord account is a member
- that member has `Manage Server` or `Administrator`

The AI module uses the same Continental identity linkage for Discord-side access. Blueprint resolves the author's linked Discord identity through the Dashboard backend before it will answer in the configured AI channel or accept `/ai`.

## Local Development

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Enable the `Server Members Intent` for the bot.
3. Make sure the Dashboard auth backend is running and its Discord provider is configured.
4. Allow the Blueprint origin in the Dashboard auth backend redirect settings.
5. Install dependencies:

```bash
npm install
```

6. Set the required environment variables.
7. Start the app:

```bash
npm start
```

8. Open:

```text
http://localhost:3000
```

## Required Environment Variables

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_SESSION_SECRET=
AUTH_API_BASE_URL=
AUTH_LOGIN_POPUP_URL=
AI_SERVER_BASE_URL=
VANGUARD_BACKEND_API_KEY=
```

For production, also set:

```text
NODE_ENV=production
BASE_URL=https://your-blueprint-domain.example
DATA_DIR=/var/lib/blueprint
```

`DISCORD_SESSION_SECRET` should be a unique random value of at least 32 characters. When
`NODE_ENV=production`, startup fails if required URLs are invalid, `BASE_URL` is not HTTPS,
or the session secret is too short.

## Optional Environment Variables

```text
BASE_URL=http://localhost:3000
DATA_DIR=./data
PORT=3000
DISCORD_GUILD_ID=
AUTH_TRUSTED_LOGIN_ORIGINS=
SESSION_COOKIE_NAME=blueprint.sid
AUTH_REQUEST_TIMEOUT_SECONDS=10
AI_SERVER_URL=http://localhost:3001/ask
AI_ASK_URL=
AI_CHAT_URL=
AI_HEALTH_URL=
AI_MODELS_URL=
AI_SESSION_URL=
AI_REQUEST_TIMEOUT_SECONDS=60
AI_CHAT_STYLE=balanced
AI_HISTORY_MESSAGES=12
AI_USE_CONTEXT=true
AI_USE_CACHE=true
AI_INCLUDE_DEBUG=false
AI_MODEL=
AI_TEMPERATURE=
AI_TOP_P=
AI_NUM_PREDICT=
AI_REPEAT_PENALTY=
CONTINENTAL_ID_BASE_URL=http://localhost:5000
CONTINENTAL_ID_AUTH_BASE_URL=http://localhost:5000
CONTINENTAL_ID_HEALTH_URL=
CONTINENTAL_ID_RESOLVE_URL=
CONTINENTAL_ID_LOGIN_URL=https://login.continental-hub.com/popup.html
CONTINENTAL_ID_DASHBOARD_URL=https://dashboard.continental-hub.com/?tab=settings
VANGUARD_BACKEND_KEY_HEADER=X-Vanguard-Api-Key
VANGUARD_INSTANCE_HEADER=X-Vanguard-Instance-Id
VANGUARD_INSTANCE_ID=
```

## Storage

- Guild configuration is stored in `${DATA_DIR}/control-center.db`.
- Auth sessions are stored in `${DATA_DIR}/sessions.db` using the same SQLite runtime.
- Runtime database files are ignored by Git and should be backed up by the deployment environment.

## Production Checks

See [PUBLIC_LAUNCH_READINESS.md](PUBLIC_LAUNCH_READINESS.md) for the full public-launch gate and evidence checklist.

The app exposes:

- `/healthz` for a lightweight process health check
- `/readyz` for bot and storage readiness

Privileged dashboard POST routes use same-origin checks and CSRF tokens. Run the app behind
HTTPS in production so secure cookies and HSTS are active.

## Testing

Run the current automated tests with:

```bash
npm test
```

When shipping module work, also verify:

- module enable/disable behavior
- invalid setting handling
- permission checks
- mobile dashboard usability
- sane defaults on a fresh server
- behavior on a heavily customized server

## Security

See [SECURITY.md](SECURITY.md) for reporting guidance. The running app also publishes a machine-readable security contact at `/security.txt`.
