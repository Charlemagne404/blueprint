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
- `VANGUARD_BACKEND_API_KEY` when Continental ID server-side resolution is enabled

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

## State and backups

Blueprint stores its SQLite state in `DATA_DIR`:

- `control-center.db` — guild configuration and module state
- `sessions.db` — authenticated web sessions

Back up both files consistently before deployment or rollback. Include any `-wal`
and `-shm` files only through a SQLite-aware backup procedure; do not copy a live
database with an ordinary file copy and call that a restore-tested backup.

## Rollback

1. Stop the service and create an encrypted, access-controlled backup of both databases.
2. Check out the previous known-good release commit or tag.
3. Run `npm ci` and the verification commands above.
4. Confirm configuration compatibility, especially auth URLs, session secrets, AI settings,
   and any Discord permission or command changes.
5. Start the service and verify health, readiness, public HTTPS, Discord login, and slash
   command registration.
6. If a schema migration is ever introduced, follow its documented down/forward-compatibility
   procedure rather than assuming a code rollback is sufficient.

Do not commit `.env`, databases, logs, backups, or generated runtime files.
