# Blueprint incident response runbook

This runbook is the operational starting point for the public-launch review. Replace the
bracketed owners and contacts before launch, keep it outside public repositories if it ever
contains sensitive infrastructure details, and record all actions with UTC timestamps.

## First response

1. **Coordinator:** `[assign on-call owner]` declares the incident and opens the incident log.
2. Capture the release SHA, service status, `/healthz`, `/readyz`, recent structured events,
   and the last successful backup. Do not paste tokens, cookies, prompts, or message content
   into the incident record.
3. Choose containment before diagnosis: disable the affected module, stop the service, revoke
   a credential, or block a provider path as appropriate.
4. Preserve the smallest necessary evidence, communicate a status update, and record the
   decision to restore, roll back, or continue degraded.

## Scenario actions

### Discord outage or gateway disconnect

- Keep the HTTP process running so `/healthz` remains available.
- Check `/readyz`, `discord_shard_disconnected`, `discord_shard_reconnecting`, and
  `discord_session_invalidated` events.
- Do not repeatedly restart a healthy process; the gateway retry loop is bounded to one
  scheduled retry window.
- If Discord is unavailable for the incident threshold, publish a degraded-service update.

### Authentication outage or unauthorized dashboard access

- Confirm the auth provider status without exposing access tokens.
- Keep public pages available; the dashboard should fail with a recoverable auth message.
- For suspected unauthorized access, rotate `DISCORD_SESSION_SECRET`, restart, and review
  dashboard authorization and auth failure metrics.
- Revoke or rotate provider credentials through the deployment secret manager.

### AI provider outage or unsafe AI behavior

- Disable the AI module globally through deployment configuration or per server in the
  dashboard, then stop new provider requests.
- Preserve only bounded error metrics and provider correlation data; do not copy prompts into
  logs or incident tickets.
- Verify `/metrics` shows failures falling to zero before re-enabling the module.

### Database failure, corruption, or disk pressure

- Stop writes and protect the live data directory. Do not copy a live WAL database with a
  file manager.
- Check disk space, file ownership, SQLite integrity, and journal/WAL files.
- Restore both databases into an isolated directory with `npm run verify:backup` before
  replacing live state. Record measured recovery time and the chosen recovery point.

### Leaked secret

- Revoke/rotate the secret immediately in its issuing system and in the deployment secret
  manager. Never commit the replacement value.
- Preserve the redacted finding, affected release SHA, and rotation timestamp.
- Invalidate sessions by rotating `DISCORD_SESSION_SECRET` and restart if the session secret
  or cookies may have been exposed.
- Run the secret-hygiene and dependency checks before redeploying.

### Runaway automation or abuse

- Disable Automations, AI, or the affected module first. If the dashboard is unavailable,
  stop the service or revoke the bot token as the containment boundary.
- Inspect cooldown-drop and request metrics, then check Discord channel creation/message rate.
- Delete unwanted Discord artifacts through an approved operator workflow; local guild state
  can be removed with `npm run delete:guild-data` after evidence/retention decisions.

### Failed restore

- Do not overwrite the only live copy. Keep the failed restore isolated.
- Record the backup manifest/checksum error, SQLite integrity result, and measured time.
- Select the previous verified backup or rollback release, then repeat the isolated restore
  before retrying production recovery.

## Recovery and communication

- **Technical owner:** `[assign]`
- **Security/privacy owner:** `[assign]`
- **Discord/community owner:** `[assign]`
- **Support contact:** `https://contact.continental-hub.com` (confirm active monitoring)
- **Target update cadence:** `[assign, e.g. every 30 minutes]`

Run a tabletop exercise covering at least an auth outage, leaked session secret, runaway
automation, and failed restore before public launch. Attach the exercise notes to the release
evidence packet.
