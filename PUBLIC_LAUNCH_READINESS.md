# Blueprint public launch readiness

**Decision rule:** Blueprint is not ready for a public launch until every launch-blocking item in this document is checked, evidence is attached or linked, and the final go/no-go review is recorded. A green local test run is necessary but not sufficient.

**Last reviewed:** 2026-08-22
**Current recommendation:** NO-GO for public launch; suitable for controlled private beta after live-server validation.

## How to use this checklist

- Check an item only when the behavior has been verified in the environment named by the item.
- Link evidence in the Notes / evidence column or in the release record.
- Treat every unchecked P0 item as a launch blocker.
- Record accepted risks explicitly with an owner, expiry date, and mitigation. Do not silently waive them.
- Re-run the release checks from a clean commit, not only from a dirty development worktree.

## Current local baseline

These are useful signals from the current checkout, but they do not prove production readiness:

- [x] `npm test` passes: 51 tests.
- [x] JavaScript syntax checks pass for the application and changed runtime files.
- [x] `npm audit --omit=dev --audit-level=moderate` reports zero vulnerabilities.
- [x] `git diff --check` passes.
- [x] Express smoke coverage verifies `/healthz` and `/readyz` without a Discord login.
- [x] The prior fake automation-ticket message has been replaced with real ticket-channel creation.
- [x] Modmail has durable forwarded-message mappings and staff reply routing.
- [x] The reaction-role UI no longer claims to support a multi-role limit that the runtime cannot enforce.
- [x] The bot invite no longer requests Administrator; the generated permissions must still be verified in Discord before launch.
- [ ] The current worktree is clean, reviewed, committed, and reproducible from a fresh checkout.
- [ ] A real Discord test server, production deployment, external auth service, and AI service have completed the acceptance matrix below.

## P0 — must be complete before public launch

### 1. Release provenance and reproducibility

- [ ] Review every changed and untracked file in the release commit; confirm no unrelated work, credentials, local databases, or temporary assets are included.
- [ ] Commit the release to a named release branch or tag and record the exact commit SHA.
- [ ] Build and test from a fresh checkout at that SHA.
- [ ] Make dependency installation reproducible outside the developer's machine. In particular, resolve the private `file:../continental-id-client` dependency in `package.json` for the deployment environment, CI, and disaster-recovery setup.
- [ ] Confirm the lockfile matches `package.json` and that the deployment uses `npm ci` or an equivalent immutable install.
- [ ] Pin and document the production Node.js version (the repository currently requires Node 20 or newer).
- [ ] Add or verify CI coverage for install, tests, syntax checks, dependency audit, and a production-mode configuration check.
- [ ] Produce a release changelog covering user-visible behavior, permission changes, data migrations, and rollback notes.

### 2. Live Discord test-server acceptance

Use a disposable Discord server with a fresh installation and a second server with heavily customized permissions, channel types, roles, and existing content.

#### Installation and access

- [ ] Install Blueprint using the generated least-privilege invite URL; inspect the requested permissions in Discord rather than trusting the URL alone.
- [ ] Verify the bot appears in the server and slash commands register successfully.
- [ ] Verify a user without `Manage Server` or `Administrator` cannot see or mutate that server in the dashboard.
- [ ] Verify a linked Continental ID user can see only installed, joined, manageable servers.
- [ ] Verify a user with a linked Discord account in multiple servers receives the correct server-specific settings.
- [ ] Remove the bot or remove the user's permission and confirm access is revoked without stale dashboard access.

#### Common module checks

For every module below, verify all of the following where applicable:

- [ ] Fresh-server defaults are safe and disabled unless explicitly intended.
- [ ] Enable, save, reload, disable, and save again all persist correctly.
- [ ] Invalid channel IDs, role IDs, message IDs, dates, numbers, and text are rejected server-side.
- [ ] Deleted or inaccessible channels and roles make the module show a clear setup error rather than silently failing.
- [ ] Bot permission and role-hierarchy failures are shown before activation.
- [ ] Discord API failures do not crash unrelated modules or the process.
- [ ] The module works with customized server names, Unicode usernames, private channels, and non-default role order.
- [ ] The module works after a process restart with its persisted state intact.

#### Module-by-module workflows

- [ ] **Core commands and dashboard:** `/ping`, `/hello`, `/dashboard`, and `/countdown` honor per-server settings; disabled commands explain their state; dashboard save errors preserve the submitted values and show a useful message.
- [ ] **Countdown:** calendar and active-day modes, excluded dates, target-day behavior, timezone-specific daily alerts, duplicate-alert prevention, countdown removal, and restart recovery all work.
- [ ] **Welcome:** new human members receive the configured message in the selected channel; bot joins, missing permissions, missing channels, and template tokens behave safely.
- [ ] **Auto role:** only assignable roles are offered; role hierarchy and Manage Roles failures are blocked; bot users are skipped.
- [ ] **Audit log:** member joins, leaves, message deletes, and role changes are logged according to each toggle; deleted/partial messages do not crash logging; sensitive content is not overexposed.
- [ ] **Auto moderation:** invite blocking, blocked words, mention limits, message deletion, timeout, exempt users, bots, and missing Manage Messages / Moderate Members permissions behave as documented.
- [ ] **Join screening:** account-age flag, kick, and quarantine paths work; quarantine role hierarchy is enforced; onboarding stops only when the configured action actually prevents continuation.
- [ ] **Announcements:** `/announce` enforces server-management permission, destination validation, safe role mentions, and the configured default role.
- [ ] **Highlights / starboard:** threshold counts, self-star policy, attachments, duplicate updates, deleted source messages, missing destination channels, and bot messages behave correctly.
- [ ] **Suggestions:** public and review copies, anonymous mode, numbering, validation, mention safety, and the suggestion-created automation trigger work; partial delivery is reported or recoverable.
- [ ] **Tickets:** panel creation and resync, duplicate-open prevention, private channel overwrites, support-role access, close authorization, transcript delivery, deleted-channel recovery, and restart recovery work.
- [ ] **Leveling:** XP cooldown, thresholds, level-up messages, announcement channel validation, persistence, bots, and high-volume messages behave correctly.
- [ ] **Reaction roles:** the configured message and emoji assign and remove the single configured role, role hierarchy is respected, bot users are skipped, and missing/partial reactions do not crash the bot.
- [ ] **Anti-raid:** threshold and time window, alert delivery, slowmode application, preservation of pre-existing slowmode, restoration after expiry, manual disable, restart, and missing channel permissions are verified.
- [ ] **Automations:** member-join, keyword, and suggestion-created triggers; send-message, real-ticket, and assign-role actions; cooldowns; missing member context; and dependent Tickets / Auto role configuration are verified.
- [ ] **Modmail:** inbound DMs, durable forwarded-message mapping, role-gated staff replies, replies after restart, disabled DMs, attachments, multiple servers, and disabled/missing inboxes are verified. Confirm that staff cannot reply from an unrelated channel or without the configured role/server-management permission.
- [ ] **Applications:** modal limits, prompt ordering, required answers, reviewer routing, mention safety, missing destination/role, and repeated submissions are verified.
- [ ] **AI tools:** channel gating, mention gating, Continental ID linkage, banned/unlinked accounts, provider timeout/error, session reset, history isolation by guild/channel/user, message length limits, and service-unavailable behavior are verified. Decide explicitly whether AI is enabled for public launch or disabled by default.

### 3. Authentication, authorization, and security

- [ ] Run production configuration validation with real non-default values: HTTPS `BASE_URL`, explicit auth API URL, hosted login URL, strong session secret, Discord credentials, and all required service keys.
- [ ] Verify the Continental ID popup and redirect flow on Chrome, Safari, Firefox, mobile Safari, and mobile Chrome.
- [ ] Verify popup-blocked, popup-closed, expired-token, invalid-token, auth-backend-down, and OAuth-link-failure states are understandable and recoverable.
- [ ] Verify session fixation protection after login, session expiration, logout, CSRF rejection, same-origin rejection, and secure cookie behavior over HTTPS.
- [ ] Verify trusted login origins contain only the intended production origins; reject crafted `postMessage` events and open redirects.
- [ ] Verify all dashboard GET and POST authorization checks against real Discord membership and permissions, including a user who loses access between page load and save.
- [ ] Verify role hierarchy, channel access, message IDs, and Discord API responses are validated server-side for every module.
- [ ] Verify the production invite does not grant Administrator and that each enabled module has the permissions it actually needs.
- [ ] Confirm no access tokens, session cookies, API keys, AI prompts, private DMs, or full Discord message contents appear in logs, error pages, analytics, or crash reports.
- [ ] Rotate all development/test credentials before production and store production secrets only in the deployment secret manager.
- [ ] Run a focused security review of auth, CSRF, session storage, external fetches, AI prompt/data handling, Discord permission escalation, and denial-of-service surfaces.
- [ ] Confirm the security reporting address, `/security.txt`, and `/.well-known/security.txt` point to an actively monitored contact.

### 4. Production deployment and runtime operations

- [ ] Deploy behind HTTPS with correct proxy trust, secure cookies, HSTS, and a valid certificate renewal process.
- [ ] Run the app under a process manager or container supervisor with automatic restart, bounded resources, and a documented service account.
- [ ] Confirm the HTTP server starts and exposes `/healthz` even when Discord is unavailable; confirm `/readyz` remains non-ready until bot and storage readiness are true.
- [ ] Decide whether auth and AI dependencies need explicit readiness/health gates and implement or monitor those gates accordingly.
- [ ] Verify Discord gateway reconnect behavior, slash-command registration retry behavior, and clean SIGTERM/SIGINT shutdown.
- [ ] Verify the service listens only on the intended interface and is protected by the deployment firewall / reverse proxy.
- [ ] Configure structured application logs with timestamps, severity, guild-safe correlation IDs, and redaction. Confirm log retention and access controls.
- [ ] Add alerts for process restarts, readiness failures, Discord disconnects, repeated auth failures, database errors, AI provider failures, and backup failures.
- [ ] Confirm operational dashboards or equivalent monitoring exist before launch; do not rely on manually checking logs.
- [ ] Load-test realistic dashboard saves, concurrent guild events, ticket creation, modmail, automations, and AI timeouts within Discord and provider rate limits.
- [ ] Verify external service timeouts, retries, and degraded-mode behavior do not create unbounded work or duplicate actions.
- [ ] Document Discord Developer Portal settings, privileged intents, redirect URLs, service URLs, firewall rules, secrets, and restart procedures.

### 5. Data durability, migration, and recovery

- [ ] Identify all production state: `control-center.db`, `sessions.db`, any AI/session state outside Blueprint, and deployment configuration.
- [ ] Back up both SQLite databases using a consistent, encrypted, off-host process with restricted access.
- [ ] Test a restore into an isolated environment and verify guild settings, ticket state, leveling state, starboard entries, suggestion numbering, modmail mappings, and sessions behave as expected.
- [ ] Define backup frequency, retention, encryption, storage region, deletion policy, and ownership.
- [ ] Define and test the recovery point objective and recovery time objective.
- [ ] Verify schema creation and migration behavior against an existing database from the current release and at least one prior release.
- [ ] Test database locking, disk-full behavior, permissions, WAL files, corruption detection, and safe startup failure.
- [ ] Decide whether active sessions should survive restore; document the security implications and invalidate them when appropriate.
- [ ] Add a documented rollback procedure that includes code, database schema, configuration, Discord commands, and external service compatibility.

### 6. Privacy, legal, and policy review

- [ ] Review the live Privacy Policy and Terms against the actual implementation, not only the rendered copy.
- [ ] Document what Blueprint stores for Continental ID sessions, linked Discord identities, guild settings, ticket transcripts, modmail mappings, leveling data, starboard data, suggestions, AI prompts/responses, logs, and backups.
- [ ] Document retention and deletion behavior for each data category, including member requests and server removal.
- [ ] Confirm the lawful basis, user notice, consent requirements, and processor/controller roles for Continental ID, Discord, hosting, monitoring, backups, and AI providers.
- [ ] Confirm whether AI prompts or responses leave the deployment, how they are retained, whether they train a provider model, and how public launch communicates that behavior.
- [ ] Obtain legal/counsel approval for public terms, privacy disclosures, data processing agreements, cross-border transfers, age restrictions, and Discord policy compliance where applicable.
- [ ] Confirm the security contact is staffed and that incident, privacy request, abuse report, and data deletion workflows have named owners.

### 7. UX, accessibility, and compatibility

- [ ] Test onboarding from signed-out state through Continental ID login, Discord linking, bot installation, server selection, and first module setup.
- [ ] Test dashboard layouts at mobile widths, tablet widths, desktop widths, zoomed text, long server names, long role/channel names, and empty states.
- [ ] Test keyboard-only navigation, focus order, visible focus, form labels, error association, dialog behavior, reduced motion, color contrast, and screen-reader landmarks.
- [ ] Test common browsers and the hosted login popup on supported desktop and mobile platforms.
- [ ] Verify loading, disabled, retry, timeout, stale-session, unauthorized, missing-server, missing-channel, and save-error states are clear.
- [ ] Verify no user-facing copy claims support for behavior that is disabled, external, experimental, or only partially implemented.
- [ ] Review public pages, metadata, favicon, manifest, 404, privacy, terms, security.txt, robots.txt, and sitemap on the deployed host.
- [ ] Perform a final visual review against the intended product identity and capture screenshots for the release record.

### 8. Support, abuse prevention, and incident response

- [ ] Define supported Discord server sizes, event volume, AI usage, modmail volume, and attachment/message limits.
- [ ] Verify behavior under spam joins, message floods, repeated button clicks, duplicate saves, repeated auth attempts, and provider outages.
- [ ] Confirm automations cannot create uncontrolled ticket/channel/message explosions and cooldowns are effective across process restarts where required.
- [ ] Define how operators disable a module, disconnect the bot, revoke credentials, block abusive servers/users, and stop AI or automation traffic during an incident.
- [ ] Write incident runbooks for Discord outage, auth outage, AI outage, database failure, leaked secret, unauthorized dashboard access, runaway automation, and failed restore.
- [ ] Run a tabletop incident exercise with the people who will operate the service.
- [ ] Publish a support path, response expectations, known limitations, and a way to report bugs or abuse.

## P1 — complete before or immediately after launch, with an explicit owner

These should not block a tightly controlled beta if the P0 matrix is complete, but they should have an owner and a dated follow-up:

- [ ] Add full Discord integration tests using mocks or a disposable test guild for every write path.
- [ ] Add browser E2E coverage for onboarding, login failure, dashboard save, permission denial, module setup, and mobile layout.
- [ ] Add CI checks for stale generated assets, dependency drift, secret scanning, and production configuration.
- [ ] Add metrics for per-module errors, action counts, latency, cooldown drops, and external-provider outcomes.
- [ ] Add pagination or bounded history handling for long ticket transcripts, modmail history, and high-volume guilds.
- [ ] Review the single-role reaction-role limitation and decide whether a true multi-role message system is needed.
- [ ] Review the one-table guild-settings architecture and define a migration/versioning strategy before schema growth makes it expensive to change.
- [ ] Add an explicit admin/operator audit trail for dashboard setting changes if the product needs accountability beyond `updated_by_user_id` and `updated_at`.
- [ ] Define product analytics only after privacy review and with a clear opt-out/data-minimization policy.

## Evidence packet required for the final go/no-go review

Attach or link all of the following to the release record:

- [ ] Release commit SHA, changelog, and clean-checkout install result.
- [ ] CI run showing tests, syntax checks, dependency audit, and production configuration validation.
- [ ] Live Discord test-server acceptance report with pass/fail results for every module.
- [ ] Browser compatibility and mobile/accessibility screenshots or recording.
- [ ] Production deployment URL, `/healthz` response, `/readyz` response, and monitoring dashboard link.
- [ ] Auth, Discord permission, and AI-provider integration evidence with sensitive values redacted.
- [ ] Backup and restore drill output, including measured recovery time and restored-data verification.
- [ ] Security review findings and remediation/accepted-risk record.
- [ ] Privacy/legal/policy approval and the final public URLs.
- [ ] Incident and rollback runbooks, on-call owner, support contact, and launch monitoring schedule.

## Final go/no-go sign-off

| Area | Owner | Evidence | Status |
| --- | --- | --- | --- |
| Code and release integrity |  |  | ☐ |
| Discord live acceptance |  |  | ☐ |
| Authentication and security |  |  | ☐ |
| Deployment and monitoring |  |  | ☐ |
| Backup and restore |  |  | ☐ |
| Privacy, legal, and policy |  |  | ☐ |
| UX, accessibility, and compatibility |  |  | ☐ |
| Support and incident response |  |  | ☐ |

**Launch decision:** ☐ GO  ☐ NO-GO
**Decision date:**
**Release SHA:**
**Decision makers:**
**Accepted risks and expiry dates:**
