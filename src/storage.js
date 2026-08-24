const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");
const config = require("./config");
const {
  DEFAULT_DAILY_ALERT_TIME,
  DEFAULT_DAILY_ALERT_TIME_ZONE,
  deserializeExcludedDates,
  deserializeWeekdays,
  normalizeCountdownAlertTime,
  normalizeCountdownAlertTimeZone,
  serializeExcludedDates,
  serializeWeekdays,
} = require("./countdown");
const { defaults: announcementDefaults } = require("./modules/announcements");
const { defaults: aiToolsDefaults } = require("./modules/ai-tools");
const { defaults: antiRaidDefaults } = require("./modules/anti-raid");
const { defaults: auditLogDefaults } = require("./modules/audit-log");
const { defaults: autoModerationDefaults } = require("./modules/auto-moderation");
const { defaults: autoRoleDefaults } = require("./modules/auto-role");
const { defaults: joinScreeningDefaults } = require("./modules/join-screening");
const { defaults: starboardDefaults } = require("./modules/starboard");
const { defaults: suggestionDefaults } = require("./modules/suggestions");
const { defaults: ticketDefaults } = require("./modules/tickets");
const { defaults: levelingDefaults } = require("./modules/leveling");
const { defaults: reactionRoleDefaults } = require("./modules/reaction-roles");
const { defaults: welcomeDefaults } = require("./modules/welcome");
const { defaults: automationDefaults } = require("./modules/automations");
const { defaults: modmailDefaults } = require("./modules/modmail");
const { defaults: applicationDefaults } = require("./modules/applications");

const dataDir = config.dataDir;
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "control-center.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    ping_response TEXT NOT NULL DEFAULT 'Pong.',
    hello_enabled INTEGER NOT NULL DEFAULT 1,
    hello_template TEXT NOT NULL DEFAULT 'Hello, {user}.',
    accent_color TEXT NOT NULL DEFAULT '#5865f2',
    countdown_enabled INTEGER NOT NULL DEFAULT 0,
    countdown_title TEXT NOT NULL DEFAULT '',
    countdown_target_date TEXT NOT NULL DEFAULT '',
    countdown_mode TEXT NOT NULL DEFAULT 'calendar',
    countdown_weekdays TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    countdown_excluded_dates TEXT NOT NULL DEFAULT '[]',
    countdown_alert_enabled INTEGER NOT NULL DEFAULT 0,
    countdown_alert_channel_id TEXT NOT NULL DEFAULT '',
    countdown_alert_time TEXT NOT NULL DEFAULT '09:00',
    countdown_alert_time_zone TEXT NOT NULL DEFAULT 'UTC',
    welcome_enabled INTEGER NOT NULL DEFAULT 0,
    welcome_channel_id TEXT NOT NULL DEFAULT '',
    welcome_message_template TEXT NOT NULL DEFAULT 'Welcome to {server}, {mention}.',
    auto_role_enabled INTEGER NOT NULL DEFAULT 0,
    auto_role_role_id TEXT NOT NULL DEFAULT '',
    audit_log_enabled INTEGER NOT NULL DEFAULT 0,
    audit_log_channel_id TEXT NOT NULL DEFAULT '',
    audit_log_member_join_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_member_leave_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_message_delete_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_role_change_enabled INTEGER NOT NULL DEFAULT 0,
    auto_moderation_enabled INTEGER NOT NULL DEFAULT 0,
    auto_moderation_log_channel_id TEXT NOT NULL DEFAULT '',
    auto_moderation_block_invites INTEGER NOT NULL DEFAULT 1,
    auto_moderation_blocked_words TEXT NOT NULL DEFAULT '[]',
    auto_moderation_mention_limit INTEGER NOT NULL DEFAULT 5,
    auto_moderation_timeout_minutes INTEGER NOT NULL DEFAULT 0,
    join_screening_enabled INTEGER NOT NULL DEFAULT 0,
    join_screening_alert_channel_id TEXT NOT NULL DEFAULT '',
    join_screening_min_account_age_days INTEGER NOT NULL DEFAULT 7,
    join_screening_action TEXT NOT NULL DEFAULT 'flag',
    join_screening_quarantine_role_id TEXT NOT NULL DEFAULT '',
    announcements_enabled INTEGER NOT NULL DEFAULT 0,
    announcements_channel_id TEXT NOT NULL DEFAULT '',
    announcements_default_role_id TEXT NOT NULL DEFAULT '',
    suggestions_enabled INTEGER NOT NULL DEFAULT 0,
    suggestions_channel_id TEXT NOT NULL DEFAULT '',
    suggestions_review_channel_id TEXT NOT NULL DEFAULT '',
    suggestions_anonymous_allowed INTEGER NOT NULL DEFAULT 0,
    tickets_enabled INTEGER NOT NULL DEFAULT 0,
    tickets_intake_channel_id TEXT NOT NULL DEFAULT '',
    tickets_transcript_channel_id TEXT NOT NULL DEFAULT '',
    tickets_support_role_id TEXT NOT NULL DEFAULT '',
    tickets_panel_title TEXT NOT NULL DEFAULT 'Need help? Open a support ticket.',
    leveling_enabled INTEGER NOT NULL DEFAULT 0,
    leveling_announce_channel_id TEXT NOT NULL DEFAULT '',
    leveling_xp_per_message INTEGER NOT NULL DEFAULT 15,
    leveling_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    leveling_level_up_message TEXT NOT NULL DEFAULT 'GG {mention}, you''re now level {level}!',
    reaction_roles_enabled INTEGER NOT NULL DEFAULT 0,
    reaction_roles_channel_id TEXT NOT NULL DEFAULT '',
    reaction_roles_message_id TEXT NOT NULL DEFAULT '',
    reaction_roles_role_id TEXT NOT NULL DEFAULT '',
    reaction_roles_emoji TEXT NOT NULL DEFAULT '⭐',
    reaction_roles_max_per_member INTEGER NOT NULL DEFAULT 1,
    reaction_roles_remove_on_unreact INTEGER NOT NULL DEFAULT 1,
    anti_raid_enabled INTEGER NOT NULL DEFAULT 0,
    anti_raid_alert_channel_id TEXT NOT NULL DEFAULT '',
    anti_raid_join_threshold INTEGER NOT NULL DEFAULT 8,
    anti_raid_window_seconds INTEGER NOT NULL DEFAULT 20,
    anti_raid_lockdown_minutes INTEGER NOT NULL DEFAULT 10,
    automations_enabled INTEGER NOT NULL DEFAULT 0,
    automations_log_channel_id TEXT NOT NULL DEFAULT '',
    automations_trigger TEXT NOT NULL DEFAULT 'member_join',
    automations_action TEXT NOT NULL DEFAULT 'send_message',
    automations_keyword TEXT NOT NULL DEFAULT '',
    automations_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    modmail_enabled INTEGER NOT NULL DEFAULT 0,
    modmail_inbox_channel_id TEXT NOT NULL DEFAULT '',
    modmail_staff_role_id TEXT NOT NULL DEFAULT '',
    modmail_auto_reply TEXT NOT NULL DEFAULT 'Thanks for contacting staff. We will reply soon.',
    applications_enabled INTEGER NOT NULL DEFAULT 0,
    applications_channel_id TEXT NOT NULL DEFAULT '',
    applications_reviewer_role_id TEXT NOT NULL DEFAULT '',
    applications_form_title TEXT NOT NULL DEFAULT 'Staff Application',
    applications_questions TEXT NOT NULL DEFAULT 'Why do you want to help this server?\nWhat timezone are you in?',
    ai_tools_enabled INTEGER NOT NULL DEFAULT 0,
    ai_tools_channel_id TEXT NOT NULL DEFAULT '',
    ai_tools_persona TEXT NOT NULL DEFAULT 'Helpful and concise community copilot',
    ai_tools_require_mention INTEGER NOT NULL DEFAULT 1,
    updated_by_user_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS countdown_alert_state (
    guild_id TEXT PRIMARY KEY,
    last_sent_on TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_state (
    guild_id TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS starboard_entries (
    source_message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    source_channel_id TEXT NOT NULL,
    starboard_channel_id TEXT NOT NULL,
    starboard_message_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS leveling_member_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (guild_id, user_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_runtime_state (
    guild_id TEXT PRIMARY KEY,
    panel_channel_id TEXT NOT NULL DEFAULT '',
    panel_message_id TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_open_tickets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    UNIQUE (guild_id, channel_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS modmail_message_map (
    inbox_message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS automation_cooldown_state (
    cooldown_key TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS anti_raid_lockdown_state (
    guild_id TEXT PRIMARY KEY,
    locked_until INTEGER NOT NULL DEFAULT 0,
    previous_slowmodes TEXT NOT NULL DEFAULT '[]'
  )
`);

ensureColumn("countdown_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("countdown_title", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_target_date", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_mode", "TEXT NOT NULL DEFAULT 'calendar'");
ensureColumn("countdown_weekdays", "TEXT NOT NULL DEFAULT '[1,2,3,4,5]'");
ensureColumn("countdown_excluded_dates", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("countdown_alert_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("countdown_alert_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_alert_time", `TEXT NOT NULL DEFAULT '${DEFAULT_DAILY_ALERT_TIME}'`);
ensureColumn(
  "countdown_alert_time_zone",
  `TEXT NOT NULL DEFAULT '${DEFAULT_DAILY_ALERT_TIME_ZONE}'`,
);
ensureColumn("welcome_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("welcome_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "welcome_message_template",
  "TEXT NOT NULL DEFAULT 'Welcome to {server}, {mention}.'",
);
ensureColumn("auto_role_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_role_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("audit_log_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("audit_log_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("audit_log_member_join_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_member_leave_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_message_delete_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_role_change_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_moderation_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_moderation_log_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("auto_moderation_block_invites", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("auto_moderation_blocked_words", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("auto_moderation_mention_limit", "INTEGER NOT NULL DEFAULT 5");
ensureColumn("auto_moderation_timeout_minutes", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("join_screening_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("join_screening_alert_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("join_screening_min_account_age_days", "INTEGER NOT NULL DEFAULT 7");
ensureColumn("join_screening_action", "TEXT NOT NULL DEFAULT 'flag'");
ensureColumn("join_screening_quarantine_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("announcements_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("announcements_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("announcements_default_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("starboard_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("starboard_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("starboard_threshold", "INTEGER NOT NULL DEFAULT 3");
ensureColumn("starboard_allow_self_star", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("suggestions_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("suggestions_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suggestions_review_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suggestions_anonymous_allowed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tickets_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tickets_intake_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("tickets_transcript_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("tickets_support_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("tickets_panel_title", "TEXT NOT NULL DEFAULT 'Need help? Open a support ticket.'");
ensureColumn("leveling_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("leveling_announce_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("leveling_xp_per_message", "INTEGER NOT NULL DEFAULT 15");
ensureColumn("leveling_cooldown_seconds", "INTEGER NOT NULL DEFAULT 60");
ensureColumn("leveling_level_up_message", "TEXT NOT NULL DEFAULT 'GG {mention}, you''re now level {level}!'");
ensureColumn("reaction_roles_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("reaction_roles_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("reaction_roles_message_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("reaction_roles_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("reaction_roles_emoji", "TEXT NOT NULL DEFAULT '⭐'");
ensureColumn("reaction_roles_max_per_member", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("reaction_roles_remove_on_unreact", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("anti_raid_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("anti_raid_alert_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("anti_raid_join_threshold", "INTEGER NOT NULL DEFAULT 8");
ensureColumn("anti_raid_window_seconds", "INTEGER NOT NULL DEFAULT 20");
ensureColumn("anti_raid_lockdown_minutes", "INTEGER NOT NULL DEFAULT 10");
ensureColumn("automations_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("automations_log_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("automations_trigger", "TEXT NOT NULL DEFAULT 'member_join'");
ensureColumn("automations_action", "TEXT NOT NULL DEFAULT 'send_message'");
ensureColumn("automations_keyword", "TEXT NOT NULL DEFAULT ''");
ensureColumn("automations_cooldown_seconds", "INTEGER NOT NULL DEFAULT 60");
ensureColumn("modmail_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("modmail_inbox_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("modmail_staff_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "modmail_auto_reply",
  "TEXT NOT NULL DEFAULT 'Thanks for contacting staff. We will reply soon.'",
);
ensureColumn("applications_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("applications_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("applications_reviewer_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("applications_form_title", "TEXT NOT NULL DEFAULT 'Staff Application'");
ensureColumn(
  "applications_questions",
  "TEXT NOT NULL DEFAULT 'Why do you want to help this server?\nWhat timezone are you in?'",
);
ensureColumn("ai_tools_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("ai_tools_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "ai_tools_persona",
  "TEXT NOT NULL DEFAULT 'Helpful and concise community copilot'",
);
ensureColumn("ai_tools_require_mention", "INTEGER NOT NULL DEFAULT 1");

const defaults = {
  pingResponse: "Pong.",
  helloEnabled: true,
  helloTemplate: "Hello, {user}.",
  accentColor: "#5865f2",
  countdownEnabled: false,
  countdownTitle: "",
  countdownTargetDate: "",
  countdownMode: "calendar",
  countdownWeekdays: [1, 2, 3, 4, 5],
  countdownExcludedDates: [],
  countdownAlertEnabled: false,
  countdownAlertChannelId: "",
  countdownAlertTime: DEFAULT_DAILY_ALERT_TIME,
  countdownAlertTimeZone: DEFAULT_DAILY_ALERT_TIME_ZONE,
  ...welcomeDefaults,
  ...autoRoleDefaults,
  ...auditLogDefaults,
  ...autoModerationDefaults,
  ...joinScreeningDefaults,
  ...announcementDefaults,
  ...starboardDefaults,
  ...suggestionDefaults,
  ...ticketDefaults,
  ...levelingDefaults,
  ...reactionRoleDefaults,
  ...antiRaidDefaults,
  ...automationDefaults,
  ...modmailDefaults,
  ...applicationDefaults,
  ...aiToolsDefaults,
};

function getGuildSettings(guildId) {
  const row = db
    .prepare("SELECT * FROM guild_settings WHERE guild_id = ?")
    .get(guildId);

  if (!row) {
    return { ...defaults };
  }

  return {
    ...defaults,
    pingResponse: row.ping_response,
    helloEnabled: Boolean(row.hello_enabled),
    helloTemplate: row.hello_template,
    accentColor: row.accent_color,
    countdownEnabled: Boolean(row.countdown_enabled),
    countdownTitle: row.countdown_title,
    countdownTargetDate: row.countdown_target_date,
    countdownMode: row.countdown_mode,
    countdownWeekdays: deserializeWeekdays(row.countdown_weekdays),
    countdownExcludedDates: deserializeExcludedDates(row.countdown_excluded_dates),
    countdownAlertEnabled: Boolean(row.countdown_alert_enabled),
    countdownAlertChannelId: row.countdown_alert_channel_id,
    countdownAlertTime: normalizeCountdownAlertTime(row.countdown_alert_time),
    countdownAlertTimeZone: normalizeCountdownAlertTimeZone(row.countdown_alert_time_zone),
    welcomeEnabled: Boolean(row.welcome_enabled),
    welcomeChannelId: row.welcome_channel_id,
    welcomeMessageTemplate: row.welcome_message_template,
    autoRoleEnabled: Boolean(row.auto_role_enabled),
    autoRoleRoleId: row.auto_role_role_id,
    auditLogEnabled: Boolean(row.audit_log_enabled),
    auditLogChannelId: row.audit_log_channel_id,
    auditLogMemberJoinEnabled: Boolean(row.audit_log_member_join_enabled),
    auditLogMemberLeaveEnabled: Boolean(row.audit_log_member_leave_enabled),
    auditLogMessageDeleteEnabled: Boolean(row.audit_log_message_delete_enabled),
    auditLogRoleChangeEnabled: Boolean(row.audit_log_role_change_enabled),
    autoModerationEnabled: Boolean(row.auto_moderation_enabled),
    autoModerationLogChannelId: row.auto_moderation_log_channel_id,
    autoModerationBlockInvites: Boolean(row.auto_moderation_block_invites),
    autoModerationBlockedWords: parseJsonArray(row.auto_moderation_blocked_words),
    autoModerationMentionLimit: normalizeInteger(row.auto_moderation_mention_limit, 5),
    autoModerationTimeoutMinutes: normalizeInteger(row.auto_moderation_timeout_minutes, 0),
    joinScreeningEnabled: Boolean(row.join_screening_enabled),
    joinScreeningAlertChannelId: row.join_screening_alert_channel_id,
    joinScreeningMinAccountAgeDays: normalizeInteger(
      row.join_screening_min_account_age_days,
      7,
    ),
    joinScreeningAction: row.join_screening_action || "flag",
    joinScreeningQuarantineRoleId: row.join_screening_quarantine_role_id,
    announcementsEnabled: Boolean(row.announcements_enabled),
    announcementsChannelId: row.announcements_channel_id,
    announcementsDefaultRoleId: row.announcements_default_role_id,
    starboardEnabled: Boolean(row.starboard_enabled),
    starboardChannelId: row.starboard_channel_id,
    starboardThreshold: normalizeInteger(row.starboard_threshold, 3),
    starboardAllowSelfStar: Boolean(row.starboard_allow_self_star),
    suggestionsEnabled: Boolean(row.suggestions_enabled),
    suggestionsChannelId: row.suggestions_channel_id,
    suggestionsReviewChannelId: row.suggestions_review_channel_id,
    suggestionsAnonymousAllowed: Boolean(row.suggestions_anonymous_allowed),
    ticketsEnabled: Boolean(row.tickets_enabled),
    ticketsIntakeChannelId: row.tickets_intake_channel_id,
    ticketsTranscriptChannelId: row.tickets_transcript_channel_id,
    ticketsSupportRoleId: row.tickets_support_role_id,
    ticketsPanelTitle: row.tickets_panel_title,
    levelingEnabled: Boolean(row.leveling_enabled),
    levelingAnnounceChannelId: row.leveling_announce_channel_id,
    levelingXpPerMessage: normalizeInteger(row.leveling_xp_per_message, 15),
    levelingCooldownSeconds: normalizeInteger(row.leveling_cooldown_seconds, 60),
    levelingLevelUpMessage: row.leveling_level_up_message,
    reactionRolesEnabled: Boolean(row.reaction_roles_enabled),
    reactionRolesChannelId: row.reaction_roles_channel_id,
    reactionRolesMessageId: row.reaction_roles_message_id,
    reactionRolesRoleId: row.reaction_roles_role_id,
    reactionRolesEmoji: row.reaction_roles_emoji || reactionRoleDefaults.reactionRolesEmoji,
    reactionRolesMaxPerMember: reactionRoleDefaults.reactionRolesMaxPerMember,
    reactionRolesRemoveOnUnreact: Boolean(row.reaction_roles_remove_on_unreact),
    antiRaidEnabled: Boolean(row.anti_raid_enabled),
    antiRaidAlertChannelId: row.anti_raid_alert_channel_id,
    antiRaidJoinThreshold: normalizeInteger(
      row.anti_raid_join_threshold,
      antiRaidDefaults.antiRaidJoinThreshold,
    ),
    antiRaidWindowSeconds: normalizeInteger(
      row.anti_raid_window_seconds,
      antiRaidDefaults.antiRaidWindowSeconds,
    ),
    antiRaidLockdownMinutes: normalizeInteger(
      row.anti_raid_lockdown_minutes,
      antiRaidDefaults.antiRaidLockdownMinutes,
    ),
    automationsEnabled: Boolean(row.automations_enabled),
    automationsLogChannelId: row.automations_log_channel_id,
    automationsTrigger: row.automations_trigger || "member_join",
    automationsAction: row.automations_action || "send_message",
    automationsKeyword: row.automations_keyword || "",
    automationsCooldownSeconds: normalizeInteger(row.automations_cooldown_seconds, 60),
    modmailEnabled: Boolean(row.modmail_enabled),
    modmailInboxChannelId: row.modmail_inbox_channel_id,
    modmailStaffRoleId: row.modmail_staff_role_id,
    modmailAutoReply: row.modmail_auto_reply || "Thanks for contacting staff. We will reply soon.",
    applicationsEnabled: Boolean(row.applications_enabled),
    applicationsChannelId: row.applications_channel_id,
    applicationsReviewerRoleId: row.applications_reviewer_role_id,
    applicationsFormTitle: row.applications_form_title || "Staff Application",
    applicationsQuestions:
      row.applications_questions ||
      "Why do you want to help this server?\nWhat timezone are you in?",
    aiToolsEnabled: Boolean(row.ai_tools_enabled),
    aiToolsChannelId: row.ai_tools_channel_id,
    aiToolsPersona: row.ai_tools_persona || aiToolsDefaults.aiToolsPersona,
    aiToolsRequireMention:
      row.ai_tools_require_mention == null
        ? aiToolsDefaults.aiToolsRequireMention
        : Boolean(row.ai_tools_require_mention),
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
  };
}

function saveGuildSettings(guildId, settings, updatedByUserId) {
  const values = [
    guildId,
    settings.pingResponse,
    settings.helloEnabled ? 1 : 0,
    settings.helloTemplate,
    settings.accentColor,
    settings.countdownEnabled ? 1 : 0,
    settings.countdownTitle,
    settings.countdownTargetDate,
    settings.countdownMode,
    serializeWeekdays(settings.countdownWeekdays),
    serializeExcludedDates(settings.countdownExcludedDates),
    settings.countdownAlertEnabled ? 1 : 0,
    settings.countdownAlertChannelId,
    normalizeCountdownAlertTime(settings.countdownAlertTime),
    normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
    settings.welcomeEnabled ? 1 : 0,
    settings.welcomeChannelId,
    settings.welcomeMessageTemplate,
    settings.autoRoleEnabled ? 1 : 0,
    settings.autoRoleRoleId,
    settings.auditLogEnabled ? 1 : 0,
    settings.auditLogChannelId,
    settings.auditLogMemberJoinEnabled ? 1 : 0,
    settings.auditLogMemberLeaveEnabled ? 1 : 0,
    settings.auditLogMessageDeleteEnabled ? 1 : 0,
    settings.auditLogRoleChangeEnabled ? 1 : 0,
    settings.autoModerationEnabled ? 1 : 0,
    settings.autoModerationLogChannelId,
    settings.autoModerationBlockInvites ? 1 : 0,
    JSON.stringify(settings.autoModerationBlockedWords || []),
    settings.autoModerationMentionLimit,
    settings.autoModerationTimeoutMinutes,
    settings.joinScreeningEnabled ? 1 : 0,
    settings.joinScreeningAlertChannelId,
    settings.joinScreeningMinAccountAgeDays,
    settings.joinScreeningAction,
    settings.joinScreeningQuarantineRoleId,
    settings.announcementsEnabled ? 1 : 0,
    settings.announcementsChannelId,
    settings.announcementsDefaultRoleId,
    settings.starboardEnabled ? 1 : 0,
    settings.starboardChannelId,
    settings.starboardThreshold,
    settings.starboardAllowSelfStar ? 1 : 0,
    settings.suggestionsEnabled ? 1 : 0,
    settings.suggestionsChannelId,
    settings.suggestionsReviewChannelId,
    settings.suggestionsAnonymousAllowed ? 1 : 0,
    settings.ticketsEnabled ? 1 : 0,
    settings.ticketsIntakeChannelId,
    settings.ticketsTranscriptChannelId,
    settings.ticketsSupportRoleId,
    settings.ticketsPanelTitle,
    settings.levelingEnabled ? 1 : 0,
    settings.levelingAnnounceChannelId,
    settings.levelingXpPerMessage,
    settings.levelingCooldownSeconds,
    settings.levelingLevelUpMessage,
    settings.reactionRolesEnabled ? 1 : 0,
    settings.reactionRolesChannelId,
    settings.reactionRolesMessageId,
    settings.reactionRolesRoleId,
    settings.reactionRolesEmoji,
    settings.reactionRolesMaxPerMember,
    settings.reactionRolesRemoveOnUnreact ? 1 : 0,
    settings.antiRaidEnabled ? 1 : 0,
    settings.antiRaidAlertChannelId,
    settings.antiRaidJoinThreshold,
    settings.antiRaidWindowSeconds,
    settings.antiRaidLockdownMinutes,
    settings.automationsEnabled ? 1 : 0,
    settings.automationsLogChannelId,
    settings.automationsTrigger,
    settings.automationsAction,
    settings.automationsKeyword,
    settings.automationsCooldownSeconds,
    settings.modmailEnabled ? 1 : 0,
    settings.modmailInboxChannelId,
    settings.modmailStaffRoleId,
    settings.modmailAutoReply,
    settings.applicationsEnabled ? 1 : 0,
    settings.applicationsChannelId,
    settings.applicationsReviewerRoleId,
    settings.applicationsFormTitle,
    settings.applicationsQuestions,
    settings.aiToolsEnabled ? 1 : 0,
    settings.aiToolsChannelId,
    settings.aiToolsPersona,
    settings.aiToolsRequireMention ? 1 : 0,
    updatedByUserId,
  ];

  db.prepare(`
    INSERT INTO guild_settings (
      guild_id,
      ping_response,
      hello_enabled,
      hello_template,
      accent_color,
      countdown_enabled,
      countdown_title,
      countdown_target_date,
      countdown_mode,
      countdown_weekdays,
      countdown_excluded_dates,
      countdown_alert_enabled,
      countdown_alert_channel_id,
      countdown_alert_time,
      countdown_alert_time_zone,
      welcome_enabled,
      welcome_channel_id,
      welcome_message_template,
      auto_role_enabled,
      auto_role_role_id,
      audit_log_enabled,
      audit_log_channel_id,
      audit_log_member_join_enabled,
      audit_log_member_leave_enabled,
      audit_log_message_delete_enabled,
      audit_log_role_change_enabled,
      auto_moderation_enabled,
      auto_moderation_log_channel_id,
      auto_moderation_block_invites,
      auto_moderation_blocked_words,
      auto_moderation_mention_limit,
      auto_moderation_timeout_minutes,
      join_screening_enabled,
      join_screening_alert_channel_id,
      join_screening_min_account_age_days,
      join_screening_action,
      join_screening_quarantine_role_id,
      announcements_enabled,
      announcements_channel_id,
      announcements_default_role_id,
      starboard_enabled,
      starboard_channel_id,
      starboard_threshold,
      starboard_allow_self_star,
      suggestions_enabled,
      suggestions_channel_id,
      suggestions_review_channel_id,
      suggestions_anonymous_allowed,
      tickets_enabled,
      tickets_intake_channel_id,
      tickets_transcript_channel_id,
      tickets_support_role_id,
      tickets_panel_title,
      leveling_enabled,
      leveling_announce_channel_id,
      leveling_xp_per_message,
      leveling_cooldown_seconds,
      leveling_level_up_message,
      reaction_roles_enabled,
      reaction_roles_channel_id,
      reaction_roles_message_id,
      reaction_roles_role_id,
      reaction_roles_emoji,
      reaction_roles_max_per_member,
      reaction_roles_remove_on_unreact,
      anti_raid_enabled,
      anti_raid_alert_channel_id,
      anti_raid_join_threshold,
      anti_raid_window_seconds,
      anti_raid_lockdown_minutes,
      automations_enabled,
      automations_log_channel_id,
      automations_trigger,
      automations_action,
      automations_keyword,
      automations_cooldown_seconds,
      modmail_enabled,
      modmail_inbox_channel_id,
      modmail_staff_role_id,
      modmail_auto_reply,
      applications_enabled,
      applications_channel_id,
      applications_reviewer_role_id,
      applications_form_title,
      applications_questions,
      ai_tools_enabled,
      ai_tools_channel_id,
      ai_tools_persona,
      ai_tools_require_mention,
      updated_by_user_id,
      updated_at
    ) VALUES (${values.map(() => "?").join(", ")}, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      ping_response = excluded.ping_response,
      hello_enabled = excluded.hello_enabled,
      hello_template = excluded.hello_template,
      accent_color = excluded.accent_color,
      countdown_enabled = excluded.countdown_enabled,
      countdown_title = excluded.countdown_title,
      countdown_target_date = excluded.countdown_target_date,
      countdown_mode = excluded.countdown_mode,
      countdown_weekdays = excluded.countdown_weekdays,
      countdown_excluded_dates = excluded.countdown_excluded_dates,
      countdown_alert_enabled = excluded.countdown_alert_enabled,
      countdown_alert_channel_id = excluded.countdown_alert_channel_id,
      countdown_alert_time = excluded.countdown_alert_time,
      countdown_alert_time_zone = excluded.countdown_alert_time_zone,
      welcome_enabled = excluded.welcome_enabled,
      welcome_channel_id = excluded.welcome_channel_id,
      welcome_message_template = excluded.welcome_message_template,
      auto_role_enabled = excluded.auto_role_enabled,
      auto_role_role_id = excluded.auto_role_role_id,
      audit_log_enabled = excluded.audit_log_enabled,
      audit_log_channel_id = excluded.audit_log_channel_id,
      audit_log_member_join_enabled = excluded.audit_log_member_join_enabled,
      audit_log_member_leave_enabled = excluded.audit_log_member_leave_enabled,
      audit_log_message_delete_enabled = excluded.audit_log_message_delete_enabled,
      audit_log_role_change_enabled = excluded.audit_log_role_change_enabled,
      auto_moderation_enabled = excluded.auto_moderation_enabled,
      auto_moderation_log_channel_id = excluded.auto_moderation_log_channel_id,
      auto_moderation_block_invites = excluded.auto_moderation_block_invites,
      auto_moderation_blocked_words = excluded.auto_moderation_blocked_words,
      auto_moderation_mention_limit = excluded.auto_moderation_mention_limit,
      auto_moderation_timeout_minutes = excluded.auto_moderation_timeout_minutes,
      join_screening_enabled = excluded.join_screening_enabled,
      join_screening_alert_channel_id = excluded.join_screening_alert_channel_id,
      join_screening_min_account_age_days = excluded.join_screening_min_account_age_days,
      join_screening_action = excluded.join_screening_action,
      join_screening_quarantine_role_id = excluded.join_screening_quarantine_role_id,
      announcements_enabled = excluded.announcements_enabled,
      announcements_channel_id = excluded.announcements_channel_id,
      announcements_default_role_id = excluded.announcements_default_role_id,
      starboard_enabled = excluded.starboard_enabled,
      starboard_channel_id = excluded.starboard_channel_id,
      starboard_threshold = excluded.starboard_threshold,
      starboard_allow_self_star = excluded.starboard_allow_self_star,
      suggestions_enabled = excluded.suggestions_enabled,
      suggestions_channel_id = excluded.suggestions_channel_id,
      suggestions_review_channel_id = excluded.suggestions_review_channel_id,
      suggestions_anonymous_allowed = excluded.suggestions_anonymous_allowed,
      tickets_enabled = excluded.tickets_enabled,
      tickets_intake_channel_id = excluded.tickets_intake_channel_id,
      tickets_transcript_channel_id = excluded.tickets_transcript_channel_id,
      tickets_support_role_id = excluded.tickets_support_role_id,
      tickets_panel_title = excluded.tickets_panel_title,
      leveling_enabled = excluded.leveling_enabled,
      leveling_announce_channel_id = excluded.leveling_announce_channel_id,
      leveling_xp_per_message = excluded.leveling_xp_per_message,
      leveling_cooldown_seconds = excluded.leveling_cooldown_seconds,
      leveling_level_up_message = excluded.leveling_level_up_message,
      reaction_roles_enabled = excluded.reaction_roles_enabled,
      reaction_roles_channel_id = excluded.reaction_roles_channel_id,
      reaction_roles_message_id = excluded.reaction_roles_message_id,
      reaction_roles_role_id = excluded.reaction_roles_role_id,
      reaction_roles_emoji = excluded.reaction_roles_emoji,
      reaction_roles_max_per_member = excluded.reaction_roles_max_per_member,
      reaction_roles_remove_on_unreact = excluded.reaction_roles_remove_on_unreact,
      anti_raid_enabled = excluded.anti_raid_enabled,
      anti_raid_alert_channel_id = excluded.anti_raid_alert_channel_id,
      anti_raid_join_threshold = excluded.anti_raid_join_threshold,
      anti_raid_window_seconds = excluded.anti_raid_window_seconds,
      anti_raid_lockdown_minutes = excluded.anti_raid_lockdown_minutes,
      automations_enabled = excluded.automations_enabled,
      automations_log_channel_id = excluded.automations_log_channel_id,
      automations_trigger = excluded.automations_trigger,
      automations_action = excluded.automations_action,
      automations_keyword = excluded.automations_keyword,
      automations_cooldown_seconds = excluded.automations_cooldown_seconds,
      modmail_enabled = excluded.modmail_enabled,
      modmail_inbox_channel_id = excluded.modmail_inbox_channel_id,
      modmail_staff_role_id = excluded.modmail_staff_role_id,
      modmail_auto_reply = excluded.modmail_auto_reply,
      applications_enabled = excluded.applications_enabled,
      applications_channel_id = excluded.applications_channel_id,
      applications_reviewer_role_id = excluded.applications_reviewer_role_id,
      applications_form_title = excluded.applications_form_title,
      applications_questions = excluded.applications_questions,
      ai_tools_enabled = excluded.ai_tools_enabled,
      ai_tools_channel_id = excluded.ai_tools_channel_id,
      ai_tools_persona = excluded.ai_tools_persona,
      ai_tools_require_mention = excluded.ai_tools_require_mention,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(...values);

  return getGuildSettings(guildId);
}

function clearCountdownAlertLastSentOn(guildId) {
  db.prepare("DELETE FROM countdown_alert_state WHERE guild_id = ?").run(guildId);
}

module.exports = {
  checkStorageHealth,
  clearCountdownAlertLastSentOn,
  clearAntiRaidLockdownState,
  clearTicketPanelState,
  closeTicketForChannel,
  closeTicketForUser,
  deleteStarboardEntry,
  defaults,
  getNextSuggestionNumber,
  getCountdownAlertLastSentOn,
  getAutomationCooldown,
  getAntiRaidLockdownState,
  getGuildSettings,
  getLevelingMemberStats,
  getModmailMessageMapping,
  getStarboardEntry,
  getTicketByChannel,
  getTicketByUser,
  getTicketPanelState,
  saveGuildSettings,
  setCountdownAlertLastSentOn,
  setAutomationCooldown,
  setAntiRaidLockdownState,
  setTicketPanelState,
  saveModmailMessageMapping,
  upsertLevelingMemberStats,
  upsertStarboardEntry,
  upsertTicket,
};

function checkStorageHealth() {
  db.prepare("SELECT 1").get();
  return true;
}

function getCountdownAlertLastSentOn(guildId) {
  const row = db
    .prepare("SELECT last_sent_on FROM countdown_alert_state WHERE guild_id = ?")
    .get(guildId);

  return row?.last_sent_on || "";
}

function setCountdownAlertLastSentOn(guildId, isoDate) {
  db.prepare(`
    INSERT INTO countdown_alert_state (guild_id, last_sent_on)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      last_sent_on = excluded.last_sent_on
  `).run(guildId, isoDate);
}

function getAutomationCooldown(cooldownKey) {
  const key = String(cooldownKey || "");
  if (!key) {
    return 0;
  }

  const row = db
    .prepare("SELECT expires_at FROM automation_cooldown_state WHERE cooldown_key = ?")
    .get(key);
  const expiresAt = Number(row?.expires_at) || 0;
  if (expiresAt <= Date.now()) {
    if (row) {
      db.prepare("DELETE FROM automation_cooldown_state WHERE cooldown_key = ?").run(key);
    }
    return 0;
  }

  return expiresAt;
}

function setAutomationCooldown(cooldownKey, expiresAt) {
  const key = String(cooldownKey || "");
  const normalizedExpiry = Number(expiresAt) || 0;
  if (!key) {
    return;
  }

  if (normalizedExpiry <= Date.now()) {
    db.prepare("DELETE FROM automation_cooldown_state WHERE cooldown_key = ?").run(key);
    return;
  }

  db.prepare(`
    INSERT INTO automation_cooldown_state (cooldown_key, guild_id, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(cooldown_key) DO UPDATE SET
      guild_id = excluded.guild_id,
      expires_at = excluded.expires_at
  `).run(key, key.split(":", 1)[0], normalizedExpiry);
}

function getAntiRaidLockdownState(guildId) {
  const row = db
    .prepare(`
      SELECT locked_until, previous_slowmodes
      FROM anti_raid_lockdown_state
      WHERE guild_id = ?
    `)
    .get(guildId);

  return {
    lockedUntil: Number(row?.locked_until) || 0,
    previousSlowmodes: parseJsonObjectArray(row?.previous_slowmodes),
  };
}

function setAntiRaidLockdownState(guildId, { lockedUntil = 0, previousSlowmodes = [] } = {}) {
  const entries = previousSlowmodes instanceof Map
    ? [...previousSlowmodes].map(([channelId, value]) => ({ channelId, ...value }))
    : Array.isArray(previousSlowmodes)
      ? previousSlowmodes
      : [];
  const normalizedEntries = entries
    .filter((entry) => entry && /^\d{16,20}$/.test(String(entry.channelId || "")))
    .map((entry) => ({
      applied: Math.max(0, Number(entry.applied) || 0),
      channelId: String(entry.channelId),
      previous: Math.max(0, Number(entry.previous) || 0),
    }));

  db.prepare(`
    INSERT INTO anti_raid_lockdown_state (guild_id, locked_until, previous_slowmodes)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      locked_until = excluded.locked_until,
      previous_slowmodes = excluded.previous_slowmodes
  `).run(
    guildId,
    Math.max(0, Number(lockedUntil) || 0),
    JSON.stringify(normalizedEntries),
  );
}

function clearAntiRaidLockdownState(guildId) {
  db.prepare("DELETE FROM anti_raid_lockdown_state WHERE guild_id = ?").run(guildId);
}

function getNextSuggestionNumber(guildId) {
  db.prepare(`
    INSERT INTO suggestion_state (guild_id, last_number)
    VALUES (?, 0)
    ON CONFLICT(guild_id) DO NOTHING
  `).run(guildId);

  db.prepare(`
    UPDATE suggestion_state
    SET last_number = last_number + 1
    WHERE guild_id = ?
  `).run(guildId);

  const row = db
    .prepare("SELECT last_number FROM suggestion_state WHERE guild_id = ?")
    .get(guildId);

  return row?.last_number || 1;
}

function getLevelingMemberStats(guildId, userId) {
  const row = db
    .prepare(`
      SELECT xp, level, last_message_at
      FROM leveling_member_stats
      WHERE guild_id = ? AND user_id = ?
    `)
    .get(guildId, userId);

  if (!row) {
    return {
      lastMessageAt: "",
      level: 0,
      xp: 0,
    };
  }

  return {
    lastMessageAt: row.last_message_at,
    level: normalizeInteger(row.level, 0),
    xp: normalizeInteger(row.xp, 0),
  };
}

function upsertLevelingMemberStats(guildId, userId, stats) {
  db.prepare(`
    INSERT INTO leveling_member_stats (
      guild_id,
      user_id,
      xp,
      level,
      last_message_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      xp = excluded.xp,
      level = excluded.level,
      last_message_at = excluded.last_message_at
  `).run(
    guildId,
    userId,
    normalizeInteger(stats.xp, 0),
    normalizeInteger(stats.level, 0),
    stats.lastMessageAt || "",
  );

  return getLevelingMemberStats(guildId, userId);
}

function getTicketPanelState(guildId) {
  const row = db
    .prepare(`
      SELECT panel_channel_id, panel_message_id
      FROM ticket_runtime_state
      WHERE guild_id = ?
    `)
    .get(guildId);

  return {
    panelChannelId: row?.panel_channel_id || "",
    panelMessageId: row?.panel_message_id || "",
  };
}

function setTicketPanelState(guildId, panelChannelId, panelMessageId) {
  db.prepare(`
    INSERT INTO ticket_runtime_state (
      guild_id,
      panel_channel_id,
      panel_message_id
    ) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      panel_channel_id = excluded.panel_channel_id,
      panel_message_id = excluded.panel_message_id
  `).run(guildId, panelChannelId || "", panelMessageId || "");

  return getTicketPanelState(guildId);
}

function clearTicketPanelState(guildId) {
  db.prepare("DELETE FROM ticket_runtime_state WHERE guild_id = ?").run(guildId);
}

function getTicketByUser(guildId, userId) {
  const row = db
    .prepare(`
      SELECT channel_id, created_at
      FROM ticket_open_tickets
      WHERE guild_id = ? AND user_id = ?
    `)
    .get(guildId, userId);

  if (!row) {
    return null;
  }

  return {
    channelId: row.channel_id,
    createdAt: row.created_at,
    guildId,
    userId,
  };
}

function getTicketByChannel(guildId, channelId) {
  const row = db
    .prepare(`
      SELECT user_id, created_at
      FROM ticket_open_tickets
      WHERE guild_id = ? AND channel_id = ?
    `)
    .get(guildId, channelId);

  if (!row) {
    return null;
  }

  return {
    channelId,
    createdAt: row.created_at,
    guildId,
    userId: row.user_id,
  };
}

function upsertTicket(guildId, userId, channelId) {
  db.prepare(`
    INSERT INTO ticket_open_tickets (
      guild_id,
      user_id,
      channel_id
    ) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      created_at = CURRENT_TIMESTAMP
  `).run(guildId, userId, channelId);

  return getTicketByUser(guildId, userId);
}

function closeTicketForUser(guildId, userId) {
  db.prepare(`
    DELETE FROM ticket_open_tickets
    WHERE guild_id = ? AND user_id = ?
  `).run(guildId, userId);
}

function closeTicketForChannel(guildId, channelId) {
  db.prepare(`
    DELETE FROM ticket_open_tickets
    WHERE guild_id = ? AND channel_id = ?
  `).run(guildId, channelId);
}

function getModmailMessageMapping(inboxMessageId) {
  const row = db
    .prepare(`
      SELECT inbox_message_id, guild_id, user_id, user_tag, created_at
      FROM modmail_message_map
      WHERE inbox_message_id = ?
    `)
    .get(inboxMessageId);

  if (!row) {
    return null;
  }

  return {
    createdAt: row.created_at,
    guildId: row.guild_id,
    inboxMessageId: row.inbox_message_id,
    userId: row.user_id,
    userTag: row.user_tag,
  };
}

function saveModmailMessageMapping({ inboxMessageId, guildId, userId, userTag = "" }) {
  if (!inboxMessageId || !guildId || !userId) {
    return null;
  }

  db.prepare(`
    INSERT INTO modmail_message_map (
      inbox_message_id,
      guild_id,
      user_id,
      user_tag
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(inbox_message_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      user_id = excluded.user_id,
      user_tag = excluded.user_tag
  `).run(inboxMessageId, guildId, userId, userTag);

  return getModmailMessageMapping(inboxMessageId);
}

function getStarboardEntry(sourceMessageId) {
  return db
    .prepare(`
      SELECT
        guild_id,
        source_channel_id,
        source_message_id,
        starboard_channel_id,
        starboard_message_id
      FROM starboard_entries
      WHERE source_message_id = ?
    `)
    .get(sourceMessageId);
}

function upsertStarboardEntry({
  guildId,
  sourceChannelId,
  sourceMessageId,
  starboardChannelId,
  starboardMessageId,
}) {
  db.prepare(`
    INSERT INTO starboard_entries (
      guild_id,
      source_channel_id,
      source_message_id,
      starboard_channel_id,
      starboard_message_id
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_message_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      source_channel_id = excluded.source_channel_id,
      starboard_channel_id = excluded.starboard_channel_id,
      starboard_message_id = excluded.starboard_message_id
  `).run(
    guildId,
    sourceChannelId,
    sourceMessageId,
    starboardChannelId,
    starboardMessageId,
  );
}

function deleteStarboardEntry(sourceMessageId) {
  db.prepare("DELETE FROM starboard_entries WHERE source_message_id = ?").run(sourceMessageId);
}

function ensureColumn(name, definition) {
  const columns = db.prepare("PRAGMA table_info(guild_settings)").all();
  if (columns.some((column) => column.name === name)) {
    return;
  }

  db.exec(`ALTER TABLE guild_settings ADD COLUMN ${name} ${definition}`);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObjectArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry === "object")
      : [];
  } catch {
    return [];
  }
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}
