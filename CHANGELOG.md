# Changelog

## 1.0.1 — 2026-08-23

### Release-readiness hardening

- Pinned the Continental ID client dependency to a public Git commit so clean checkouts can install it without relying on a sibling working directory.
- Added locked-install CI coverage for syntax checks, automated tests, production dependency auditing, and production configuration validation.
- Added a production configuration checker and repository-wide JavaScript syntax checker.
- Pinned the documented production Node.js runtime to `22.23.2` with `.nvmrc`.
- Added the deployment and rollback runbook in `OPERATIONS.md`.

### Compatibility and data notes

- No database schema migration is introduced by this release.
- Existing SQLite state remains in `DATA_DIR`; back up `control-center.db` and `sessions.db` before rollback or deployment changes.
- The release does not change the Discord permission set or slash-command contract.

### Rollback

1. Stop the service and back up both SQLite databases.
2. Check out the previous known-good release commit.
3. Run `npm ci` for that release and restore the deployment configuration.
4. Start the service and verify `/healthz`, `/readyz`, Discord login, and slash-command registration.
