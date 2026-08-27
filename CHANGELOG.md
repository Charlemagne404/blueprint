# Changelog

## Unreleased — 2026-08-27

### Runtime reliability and UX

- Fixed numeric settings so intentional zero values (including cooldowns, mention limits, and
  timeouts) survive dashboard saves and SQLite round trips.
- Added a configurable automation message with `{source}`, `{user}`, and `{mention}` tokens;
  suggestion-triggered role actions now receive their member context correctly.
- Added paginated, bounded ticket transcripts and split long application submissions into
  Discord-safe messages.
- Serialized leveling updates per guild/member so concurrent messages cannot overwrite earned
  XP, while unrelated members continue processing independently.
- Added explicit mention allowlists for configurable bot messages and made moderation and join
  screening reports reflect whether Discord actually completed the requested action.
- Deferred slower announcement, suggestion, application-submit, and AI interactions before
  gateway/API work so they do not expire while the bot is validating configuration.

### Launch-readiness hardening

- Completed live dashboard setup diagnostics for all 17 modules, including cross-module
  dependencies such as ticket and role automation actions, so edits update the issue queue
  before saving.
- Added configurable auth/dashboard rate limits, AI request cooldowns, bounded external
  response bodies, and correlation IDs for HTTP failures.
- Added a token-protected `/metrics` endpoint with bounded latency, failure, module-task,
  cooldown, and external-provider counters.
- Persisted automation cooldowns across restarts and added regression coverage for recovery.
- Persisted active anti-raid lockdown state and original slowmodes so a restart can restore or
  safely release an in-progress lockdown.
- Added tracked-file secret hygiene checks to the verification script and CI.
- Added an explicit guild-data deletion command with confirmation and isolated tests.
- Added data-retention, incident-response, capacity, systemd, backup-timer, and release-
  evidence documentation/templates.

### Compatibility and data notes

- Existing guild settings remain compatible; the additive `automations_message` column and the
  `automation_cooldown_state` and `anti_raid_lockdown_state` tables are created automatically
  for existing installations.
- The automation message migration is additive and has a safe default, so existing rules keep
  their previous activity notice until an administrator customizes it.
- Production deployments must set a unique `METRICS_TOKEN` of at least 32 characters.
- Guild deletion removes local Blueprint records only; Discord-side messages and external AI
  provider state require their own approved deletion workflows.

## 1.0.1 — 2026-08-23

### Release-readiness hardening

- Pinned the Continental ID client dependency to a public Git commit so clean checkouts can install it without relying on a sibling working directory.
- Added locked-install CI coverage for syntax checks, automated tests, production dependency auditing, and production configuration validation.
- Added a production configuration checker and repository-wide JavaScript syntax checker.
- Pinned the documented production Node.js runtime to `22.23.2` with `.nvmrc`.
- Added the deployment and rollback runbook in `OPERATIONS.md`.
- Kept the HTTP health surface available during Discord login failures and made readiness cover both control-center and session storage.
- Added CSRF-protected POST logout, explicit reverse-proxy trust configuration, redacted JSON application logs, and security regression tests.
- Added SQLite online-backup and isolated restore-verification commands for `control-center.db` and `sessions.db`.

### Compatibility and data notes

- No database schema migration is introduced by this release.
- Existing SQLite state remains in `DATA_DIR`; back up `control-center.db` and `sessions.db` before rollback or deployment changes.
- The release does not change the Discord permission set or slash-command contract.

### Rollback

1. Stop the service and back up both SQLite databases.
2. Check out the previous known-good release commit.
3. Run `npm ci` for that release and restore the deployment configuration.
4. Start the service and verify `/healthz`, `/readyz`, Discord login, and slash-command registration.
