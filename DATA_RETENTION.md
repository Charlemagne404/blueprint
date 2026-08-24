# Blueprint data inventory and retention

This document describes the data Blueprint stores locally and the Discord or external
provider data it causes to exist elsewhere. It is an implementation inventory, not legal
advice. The deployment owner must set the final retention periods, storage region, and
processor/controller terms before public launch.

## Local data

| Data | Location | Purpose | Current retention/deletion behavior |
| --- | --- | --- | --- |
| Authenticated web sessions | `${DATA_DIR}/sessions.db` | Keep a signed-in dashboard session | Session cookie lifetime is seven days. Expired rows are pruned during writes; operators can invalidate all sessions by replacing the session secret and removing/restoring `sessions.db` as an incident action. |
| Guild settings | `${DATA_DIR}/control-center.db`, `guild_settings` | Store per-server module configuration | Retained until the server is removed or an operator runs the explicit guild-data deletion command. |
| Countdown alert state | `countdown_alert_state` | Prevent duplicate daily alerts | Retained with the guild settings and removed by the guild-data deletion command. |
| Suggestion numbering | `suggestion_state` | Allocate stable suggestion numbers | Retained with the guild settings and removed by the guild-data deletion command. |
| Leveling stats | `leveling_member_stats` | Track XP, level, and last XP timestamp | Retained with the guild settings and removed by the guild-data deletion command. |
| Ticket runtime state | `ticket_runtime_state`, `ticket_open_tickets` | Recover panels and prevent duplicate open tickets | Retained until the guild is deleted or the records are removed by the guild-data deletion command. Ticket transcripts are not stored in these tables. |
| Modmail mappings | `modmail_message_map` | Route a staff reply to the original member | Stores message/guild/user IDs, a Discord user tag, and a timestamp. It is removed by the guild-data deletion command. Message content remains in Discord until deleted there. |
| Starboard entries | `starboard_entries` | Update or remove a mirrored starboard post | Stores Discord message/channel IDs and is removed by the guild-data deletion command. |
| Automation cooldowns | `automation_cooldown_state` | Keep automation cooldowns effective across restarts | Rows expire naturally and are removed with the guild data. |
| Anti-raid lockdown state | `anti_raid_lockdown_state` | Restore an active lockdown and original slowmodes after restart | Removed when the lockdown ends or with the guild-data deletion command. |
| Application logs | Service journal/stdout/stderr | Diagnose failures and operate the service | The application redacts credentials, cookies, prompts, message content, and token-like values. Journal retention and access must be configured by the deployment owner. |
| SQLite backups | Off-host backup storage | Recovery from data loss | Backups must be encrypted, access restricted, and assigned a documented retention period by the deployment owner. |

## Discord and provider data

- Blueprint reads Discord guild, member, role, channel, message, and reaction metadata needed
  to validate permissions and run enabled modules. It does not copy the full Discord server
  into its local database.
- Ticket transcripts are generated from up to the most recent 100 channel messages and sent
  to the configured Discord transcript channel. They remain Discord data and must be deleted
  through the server's Discord workflow when required.
- Modmail forwards the member's text and up to five safe HTTP(S) attachment links to the
  configured Discord inbox. Blueprint stores only the mapping needed to route a staff reply;
  the forwarded content remains in Discord.
- When AI is enabled, the configured AI request and Continental ID endpoints receive the
  minimum request data needed for access checks and the answer. Blueprint does not persist
  AI prompts or responses in its SQLite databases. Provider retention, training use, and
  regional processing are deployment/provider questions that must be confirmed before launch.

## Deletion workflow

For a server removal or approved server-data deletion request:

1. Confirm the requester's authority and record the request in the incident/support log.
2. Disable the bot modules or remove Blueprint from the server so new data stops arriving.
3. Create and retain an access-controlled backup if an incident or legal hold requires it.
4. Run the explicit, two-value-confirmation command from the release checkout:

   ```bash
   npm run delete:guild-data -- \
     --data-dir /var/lib/blueprint \
     --guild-id <discord-guild-id> \
     --confirm-guild-id <discord-guild-id>
   ```

5. Delete or retain Discord-side messages, ticket transcripts, and modmail posts according
   to the server's approved request and any legal hold.
6. Remove the guild from applicable encrypted backup generations according to the backup
   deletion policy. Record what could not be removed from immutable backups and the expiry
   date of those copies.

The command never deletes `sessions.db`, other guilds, or Discord-side content. If a full
session invalidation is needed, rotate `DISCORD_SESSION_SECRET` and restart the service.

## Open launch decisions

- Assign an owner and exact retention periods for application logs and backups.
- Confirm the AI provider's retention/training policy and cross-border processing.
- Confirm the lawful basis, user notice, deletion SLA, and legal-review owner.
