# Blueprint pre-launch repository readiness

**Scope:** This checklist covers only items that can be verified from the source tree, local tests, CI, configuration, and repository documentation. Live Discord/provider/deployment/browser/device/accessibility/capacity/support/legal/tabletop validation is intentionally post-launch and is not a launch blocker here.

**Decision rule:** The repository gate is ready when every repository-verifiable P0 item is checked, evidence is attached or linked, and the release is reproducible from a clean checkout.

**Last reviewed:** 2026-08-25
**Current recommendation:** Use this document for the pre-launch repository gate; record live-service validation separately after launch.

## How to use this checklist

- Check an item only when the repository contains the implementation or the linked local/CI evidence.
- Link evidence in the release record or the Notes / evidence column.
- Treat every unchecked repository P0 item as a release blocker.
- Record accepted repository risks explicitly with an owner, expiry date, and mitigation.
- Re-run the release checks from a clean commit, not only from a dirty development worktree.

## Current local baseline

- [x] `npm test` passes: 68 tests.
- [x] JavaScript syntax checks pass for the application, scripts, and runtime files (62 files).
- [x] `npm run check:secrets` scans tracked and non-ignored worktree text files for high-confidence credentials and non-placeholder secret assignments.
- [x] `npm audit --omit=dev --audit-level=moderate` reports zero vulnerabilities.
- [x] `git diff --check` passes.
- [x] Express smoke coverage verifies `/healthz` and `/readyz` without a Discord login.
- [x] The prior fake automation-ticket message has been replaced with real ticket-channel creation.
- [x] Modmail has durable forwarded-message mappings and staff reply routing.
- [x] The reaction-role UI no longer claims to support a multi-role limit that the runtime cannot enforce.
- [ ] The current worktree is clean, reviewed, committed, and reproducible from a fresh checkout.

### Repository controls completed in the 2026-08-24 readiness pass

- [x] HTTP startup keeps `/healthz` available when Discord login fails; `/readyz` stays non-ready until Discord, control-center SQLite, and session SQLite are ready.
- [x] Logout is POST-only for state changes, requires the session CSRF token, and clears the session cookie; return paths reject external, backslash, and control-character values.
- [x] Production configuration rejects insecure auth APIs, malformed trusted login origins, and a missing `VANGUARD_BACKEND_API_KEY` when AI/resolution integration is enabled; configuration output strips URL credentials and query strings.
- [x] Application runtime logs use bounded JSON events with redaction for credentials, cookies, API keys, session values, prompts, and token-like values.
- [x] SQLite online backup and isolated restore verification cover both `control-center.db` and `sessions.db`; see `OPERATIONS.md`.
- [x] `npm test` runs cleanly with the repository's `.env` present because the app smoke test explicitly uses a test environment.

### Repository controls completed in the 2026-08-25 readiness pass

- [x] Auth and dashboard write paths have bounded, configurable rate limits with `429` and `Retry-After` responses.
- [x] Auth and AI provider response bodies are capped before JSON parsing; AI requests have a per-user/channel cooldown.
- [x] Automation cooldowns and active anti-raid lockdown state persist in SQLite across process restarts, while ticket creation remains limited to one open ticket per member/server.
- [x] A token-protected `/metrics` endpoint exposes bounded request latency, failure, provider-outcome, cooldown, and module-task counters without guild/user labels.
- [x] Tracked-file secret hygiene runs in CI and `npm run verify`; production configuration requires a private `METRICS_TOKEN`.
- [x] Guild-scoped local data has an explicit, two-value-confirmation deletion command covered by an isolated database test; see `DATA_RETENTION.md`.
- [x] Capacity guardrails, systemd service/backup templates, incident procedures, and a release evidence template are documented.

### Repository-level evidence captured on 2026-08-25

- The working tree passed `npm run check:secrets`, syntax checks for 62 files, and all 68 automated tests.
- Dashboard regression coverage verifies that all 17 server modules have matching live client
  diagnostics and that their registry order remains stable.
- The hardening tests cover rate-limit rejection, metrics rendering, oversized external responses, persisted cooldown recovery, modmail attachment bounds, and guild-scoped data deletion.
- `deploy/blueprint.service`, `deploy/blueprint-backup.service`, and `deploy/blueprint-backup.timer` provide bounded service and backup templates.
- `RELEASE_EVIDENCE_TEMPLATE.md` provides the repository evidence packet structure for the release record.

### Repository-level evidence captured on 2026-08-24

- The readiness commit for this pass contains the controls above and excludes runtime databases, logs, backups, `.env`, and dependency directories.
- A fresh detached checkout at the readiness commit completed `npm ci`, syntax checks for 55 files, all 59 tests, a high-severity production dependency audit with zero vulnerabilities, and production configuration-shape validation with non-secret CI values.
- The backup test created and verified isolated copies of both SQLite databases; the local backup command was exercised without modifying the source databases.

### Repository-level evidence captured on 2026-08-23

- Release-readiness hardening was committed as `bbfb2c4` and tagged [`v1.0.1`](https://github.com/Charlemagne404/blueprint/releases/tag/v1.0.1) on `main`.
- A fresh checkout at the release commit completed `npm ci`, syntax checks, production configuration-shape validation, `npm audit`, and all 51 automated tests.
- CI run [32667495637](https://github.com/Charlemagne404/blueprint/actions/runs/32667495637) passed install, syntax, tests, audit, and production configuration-shape validation with the then-current action versions.

## P0 — repository release gate

### 1. Release provenance and reproducibility

- [x] Review every changed and untracked file in the release commit; confirm no unrelated work, credentials, local databases, or temporary assets are included. Runtime databases, logs, backups, and the pre-existing local binding edit were excluded from the release commit.
- [x] Commit the release to a named release branch or tag and record the exact commit SHA (`v1.0.1` → `bbfb2c4f329dc80d6be717d74656d160970d4c64`).
- [x] Build and test from a fresh checkout at that SHA.
- [x] Make dependency installation reproducible outside the developer's machine. The local sibling dependency was replaced with a pinned public commit archive in `package.json` and `package-lock.json`.
- [x] Confirm the lockfile matches `package.json` and that the deployment uses `npm ci` or an equivalent immutable install. Fresh-checkout and CI installs pass.
- [x] Pin and document the production Node.js version (`22.23.2` in `.nvmrc`; the package still declares Node 20 as its minimum).
- [x] Add or verify CI coverage for install, tests, syntax checks, dependency audit, secret hygiene, and a production-mode configuration check.
- [x] Produce a release changelog covering user-visible behavior, permission changes, data migrations, and rollback notes in `CHANGELOG.md`.

### 2. Security and configuration controls

- [x] Production configuration rejects insecure auth APIs, malformed trusted login origins, missing required integration keys, weak production session secrets, and missing `METRICS_TOKEN`.
- [x] Auth/session controls cover POST-only state changes, CSRF validation, session-cookie clearing, safe return paths, same-origin checks, and open-redirect protection in local regression coverage.
- [x] Dashboard and AI provider responses are bounded before parsing, and auth/dashboard write paths have configurable rate limits with `429` and `Retry-After` responses.
- [x] AI requests have a per-user/channel cooldown, and automation cooldowns persist across process restarts.
- [x] Logs use bounded structured events with redaction for credentials, cookies, API keys, session values, prompts, and token-like values.
- [x] `/metrics` is token-protected and avoids guild/user labels; counters and duration summaries are bounded in memory.
- [x] `npm run check:secrets` scans tracked and non-ignored text files, and the check runs in CI and `npm run verify`.
- [x] The guild-data deletion command requires an explicit guild ID and matching confirmation value and is covered by an isolated database test.

### 3. Runtime safety and recovery artifacts

- [x] `/healthz` remains available when Discord login fails, while `/readyz` reports non-ready until Discord and both SQLite stores are ready.
- [x] Anti-raid lockdown state and automation cooldown state persist safely across restarts; ticket creation remains limited to one open ticket per member/server.
- [x] SQLite online backup and isolated restore verification cover both `control-center.db` and `sessions.db`.
- [x] `DATA_RETENTION.md` identifies local and external data categories, retention behavior, and guild-scoped deletion behavior.
- [x] `OPERATIONS.md` documents rollback, backup, restore, capacity guardrails, and configuration requirements.
- [x] `INCIDENT_RESPONSE.md` documents containment and recovery procedures for the supported incident classes.
- [x] Service and backup templates are present under `deploy/` with bounded restart, resource, and backup settings.

### 4. Repository documentation and release records

- [x] `README.md`, `SECURITY.md`, `DATA_RETENTION.md`, `OPERATIONS.md`, and `INCIDENT_RESPONSE.md` describe the implemented controls without requiring undocumented setup.
- [x] `RELEASE_EVIDENCE_TEMPLATE.md` defines the evidence fields for the repository release record.
- [x] `CHANGELOG.md` records user-visible changes, permission changes, migrations, and rollback notes.
- [x] The repository does not include runtime databases, logs, backups, `.env` files, dependency directories, or generated secrets.

## P1 — repository follow-up

These items are code or documentation follow-ups and do not require live-service validation to assess:

- [ ] Add pagination or bounded history handling for long ticket transcripts, modmail history, and high-volume guilds.
- [ ] Review the single-role reaction-role limitation and decide whether a true multi-role message system is needed.
- [ ] Review the one-table guild-settings architecture and define a migration/versioning strategy before schema growth makes it expensive to change.
- [ ] Add an explicit admin/operator audit trail for dashboard setting changes if the product needs accountability beyond `updated_by_user_id` and `updated_at`.
- [ ] Define product analytics only after privacy requirements and data minimization are documented.

## Evidence packet for the repository release record

Attach or link the following repository-verifiable evidence:

- [ ] Release commit SHA, changelog, and clean-checkout install result.
- [ ] CI run showing install, tests, syntax checks, dependency audit, secret hygiene, and production configuration validation.
- [ ] Local automated test output, including security-hardening, backup/restore, cooldown-persistence, and guild-data-deletion coverage.
- [ ] Production configuration-shape output with secrets redacted.
- [ ] `git diff --check` and clean-worktree result for the release commit.
- [ ] Current `DATA_RETENTION.md`, `OPERATIONS.md`, `INCIDENT_RESPONSE.md`, and deployment templates.

## Repository gate sign-off

| Area | Owner | Evidence | Status |
| --- | --- | --- | --- |
| Code and release integrity |  |  | ☐ |
| Automated verification |  |  | ☐ |
| Security and configuration controls |  |  | ☐ |
| Data, backup, and deletion tooling |  |  | ☐ |
| Operational documentation and templates |  |  | ☐ |

**Repository gate:** ☐ READY FOR POST-LAUNCH VALIDATION  ☐ NOT READY
**Decision date:**
**Release SHA:**
**Decision makers:**
**Accepted repository risks and expiry dates:**

## Explicitly deferred until after launch

Live Discord behavior, hosted authentication and provider behavior, production deployment, browser/device/accessibility validation, capacity and abuse exercises, legal approval, support operations, and tabletop incident exercises are intentionally outside this checklist. Track them in the post-launch validation plan rather than as pre-launch repository blockers.
