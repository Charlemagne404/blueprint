# Blueprint operations runbook

This is the deployment and recovery runbook for the Node service. It intentionally
contains no credentials. Store secrets in the service environment or secret manager.

## Runtime contract

- Supported production runtime: Node.js `22.23.2` (`.nvmrc`).
- Install with `npm ci`; do not use a mutable install for a release deployment.
- Start with `npm run start:prod` under a process supervisor.
- Keep the service bound to its intended private interface and put it behind the HTTPS reverse proxy.
- `/healthz` reports process health. `/readyz` reports Discord and SQLite readiness.

Required production configuration includes:

- `NODE_ENV=production`
- HTTPS `BASE_URL`
- explicit `AUTH_API_BASE_URL`
- HTTPS `AUTH_LOGIN_POPUP_URL`
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and a unique 32-character `DISCORD_SESSION_SECRET`
- `VANGUARD_BACKEND_API_KEY` when AI or Continental ID server-side resolution is enabled
- `TRUST_PROXY=1` when one HTTPS reverse proxy terminates TLS before Blueprint; use `0` for a direct HTTP development process

Run the non-secret configuration check with the real deployment environment loaded:

```bash
npm run check:production-config
```

## Deploy or update

```bash
git fetch origin --prune
git checkout <release-commit-or-tag>
npm ci
npm run check:syntax
npm test
npm audit --omit=dev --audit-level=high
npm run check:production-config
sudo systemctl restart blueprint.service
curl -fsS https://<blueprint-host>/healthz
curl -fsS https://<blueprint-host>/readyz
```

The current host runs `blueprint.service` with systemd. The unit should use the
repository as its working directory, load the deployment environment, run as a
dedicated non-root service account, use `Restart=always`, and write stdout/stderr to
the system journal.

The HTTP server starts before the Discord gateway login completes. A Discord or gateway
outage therefore leaves `/healthz` available while `/readyz` returns `503`; the process
supervisor should alert on readiness failures rather than treating a dependency outage as
a reason to hide the health endpoint. The authentication and AI providers are intentionally
not hard readiness dependencies because a provider outage should leave public pages and
the dashboard's recovery states available. Monitor those providers with authenticated,
non-production synthetic checks and alert on repeated failures.

Application logs are JSON lines with UTC timestamps, severity, event names, and bounded
context. Credentials, cookies, authorization headers, access tokens, API keys, session
values, prompts, and token-like values are redacted by the application logger. Keep the
service journal access restricted to operators and configure journald retention/forwarding
according to the deployment's incident-response and data-retention policy.

The repository includes hardened systemd templates in `deploy/`. Adjust the installation
paths only during deployment, keep `/etc/blueprint/blueprint.env` readable by the service
account only, and enable both `blueprint.service` and the backup timer. The backup timer
creates a consistent local copy; it is not the off-host encrypted backup by itself.

## Capacity and abuse guardrails

The current implementation has explicit bounded inputs and request controls:

- Express JSON and form bodies are limited to 64 KiB.
- Auth provider requests time out after the configured 2–60 seconds; auth routes are limited
  by `AUTH_RATE_LIMIT_MAX_REQUESTS` per `AUTH_RATE_LIMIT_WINDOW_SECONDS` per client key.
- Dashboard writes are limited by `DASHBOARD_WRITE_RATE_LIMIT_MAX_REQUESTS` per configured
  window and server/session key.
- AI questions are capped at 1,500 characters, Discord replies at 1,900 characters, history
  at 1–24 messages, and provider calls at the configured 2–120 second timeout. A user/channel
  cooldown is controlled by `AI_USER_COOLDOWN_SECONDS`.
- Modmail and staff replies are capped at 1,800 characters. Ticket transcripts page through at
  most 500 recent messages and split the result into Discord-safe delivery messages.
- Application submissions split long multi-question answers into Discord-safe messages, and
  automation notices are capped at 240 configured characters before delivery.
- Leveling updates are serialized per guild/member in the bot process to prevent concurrent
  message events from overwriting XP; different members continue in parallel.
- Ticket creation allows one tracked open ticket per member/server. Automation cooldowns are
  persisted in SQLite so a process restart does not erase an active cooldown.
- The backup and guild-deletion commands refuse ambiguous output/target paths and require
  explicit confirmation for destructive guild-data removal.

These limits are guardrails, not a load-test result. Complete the Discord/provider load test
and define supported guild sizes, event rates, attachment policy, RPO, and RTO before launch.

For the acceptance pass, use this initial private-beta operating envelope: up to 10,000
members per guild, 60 joins/minute per guild for anti-raid evaluation, 10 handled message
events/second/guild, 60 inbound modmail messages/minute/guild, and 6 AI requests/minute/user
in a configured channel. Blueprint does not store or upload attachments; starboard and
Discord messages may contain Discord-hosted attachment URLs. Exceeding this envelope requires
a measured load test and an explicit capacity decision before public launch.

See [DATA_RETENTION.md](DATA_RETENTION.md) for the data inventory and deletion workflow and
[INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for incident containment and recovery actions.

## State and backups

Blueprint stores its SQLite state in `DATA_DIR`:

- `control-center.db` — guild configuration and module state
- `sessions.db` — authenticated web sessions

Back up both files consistently before deployment or rollback. Include any `-wal`
and `-shm` files only through a SQLite-aware backup procedure; do not copy a live
database with an ordinary file copy and call that a restore-tested backup.

Create a consistent, permission-restricted local backup while the service is running:

```bash
BACKUP_DIR=/var/lib/blueprint-backups npm run backup
```

The command uses SQLite's online backup API for both databases, writes a checksum manifest,
and refuses to write into a non-empty directory or the live `DATA_DIR`. Verify the backup
and exercise a temporary isolated restore before shipping it off host:

```bash
npm run verify:backup -- --backup-dir /var/lib/blueprint-backups/<timestamp>
```

The deployment must then encrypt the backup, transfer it to restricted off-host storage,
and apply a documented retention/deletion policy. Keep the encryption key outside the
backup host and record the backup timestamp, owner, storage region, retention, and measured
restore time in the release evidence packet. Do not commit generated backup directories.

## Rollback

1. Stop the service and create an encrypted, access-controlled backup of both databases.
2. Run `npm run verify:backup -- --backup-dir <backup-directory>` and retain its output.
3. Check out the previous known-good release commit or tag.
4. Run `npm ci` and the verification commands above.
5. Confirm configuration compatibility, especially auth URLs, session secrets, AI settings,
   and any Discord permission or command changes.
6. Start the service and verify health, readiness, public HTTPS, Discord login, and slash
   command registration.
7. The current unreleased settings change adds an `automations_message` column with a safe
   default. Verify the migration on a backup before rollback; the additive column is tolerated
   by older code, but custom automation copy is only available on the newer version.

Do not commit `.env`, databases, logs, backups, or generated runtime files.
