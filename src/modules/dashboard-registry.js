const {
  getCountdownAlertSummary,
  getCountdownResult,
  validateCountdownSettings,
} = require("../countdown");
const {
  getAnnouncementState,
  validateAnnouncementSettings,
} = require("./announcements");
const { getAiToolsState, validateAiToolsSettings } = require("./ai-tools");
const { getAntiRaidState, validateAntiRaidSettings } = require("./anti-raid");
const { getApplicationState, validateApplicationSettings } = require("./applications");
const { getAutomationState, validateAutomationSettings } = require("./automations");
const { getAuditLogState, validateAuditLogSettings } = require("./audit-log");
const {
  getAutoModerationState,
  validateAutoModerationSettings,
} = require("./auto-moderation");
const { getAutoRoleState, validateAutoRoleSettings } = require("./auto-role");
const {
  getJoinScreeningState,
  validateJoinScreeningSettings,
} = require("./join-screening");
const { getLevelingState, validateLevelingSettings } = require("./leveling");
const { getModmailState, validateModmailSettings } = require("./modmail");
const {
  getReactionRoleState,
  validateReactionRoleSettings,
} = require("./reaction-roles");
const { getSuggestionState, validateSuggestionSettings } = require("./suggestions");
const { getStarboardState, validateStarboardSettings } = require("./starboard");
const { getTicketState, validateTicketSettings } = require("./tickets");
const { getWelcomeState, validateWelcomeSettings } = require("./welcome");

const RUNTIME_UNAVAILABLE_MODULES = Object.freeze({});

const MODULE_ENABLEMENT_KEYS = Object.freeze({});

const DASHBOARD_MODULE_KEYS = Object.freeze([
  "countdown",
  "welcome",
  "autoRole",
  "auditLog",
  "autoModeration",
  "joinScreening",
  "announcements",
  "starboard",
  "suggestions",
  "reactionRoles",
  "tickets",
  "leveling",
  "antiRaid",
  "automations",
  "modmail",
  "applications",
  "aiTools",
]);

function evaluateDashboardModules({
  settings,
  guild,
  botMember,
  channelOptions = [],
  roleOptions = [],
  mentionRoleOptions = [],
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions);
  const canValidate = Boolean(guild);
  const runtimeBlockers = getRuntimeModuleBlockers(settings);
  const countdownErrors = canValidate
    ? validateCountdownSettings(settings, guild, botMember)
    : [];
  const welcomeErrors = canValidate ? validateWelcomeSettings(settings, guild, botMember) : [];
  const autoRoleErrors = canValidate ? validateAutoRoleSettings(settings, guild, botMember) : [];
  const auditLogErrors = canValidate ? validateAuditLogSettings(settings, guild, botMember) : [];
  const automodErrors = canValidate
    ? validateAutoModerationSettings(settings, guild, botMember)
    : [];
  const joinScreeningErrors = canValidate
    ? validateJoinScreeningSettings(settings, guild, botMember)
    : [];
  const announcementErrors = canValidate
    ? validateAnnouncementSettings(settings, guild, botMember)
    : [];
  const starboardErrors = canValidate ? validateStarboardSettings(settings, guild, botMember) : [];
  const suggestionErrors = canValidate ? validateSuggestionSettings(settings, guild, botMember) : [];
  const ticketErrors = canValidate ? validateTicketSettings(settings, guild, botMember) : [];
  const levelingErrors = canValidate ? validateLevelingSettings(settings, guild, botMember) : [];
  const reactionRoleErrors = canValidate
    ? validateReactionRoleSettings(settings, guild, botMember)
    : [];
  const antiRaidErrors = canValidate ? validateAntiRaidSettings(settings, guild, botMember) : [];
  const automationErrors = canValidate ? validateAutomationSettings(settings, guild, botMember) : [];
  const modmailErrors = canValidate ? validateModmailSettings(settings, guild, botMember) : [];
  const applicationErrors = canValidate ? validateApplicationSettings(settings, guild, botMember) : [];
  const aiToolsErrors = canValidate ? validateAiToolsSettings(settings, guild, botMember) : [];

  const reactionRoleState = getReactionRoleState(settings, channelOptions);
  const ticketState = getModuleState(
    settings.ticketsEnabled,
    getTicketState(settings, channelOptions, mentionRoleOptions),
    runtimeBlockers.tickets,
  );
  const levelingState = getModuleState(
    settings.levelingEnabled,
    getLevelingState(settings, channelOptions),
    runtimeBlockers.leveling,
  );
  const antiRaidState = getAntiRaidState(settings, channelOptions);
  const automationState = getAutomationState(settings, channelOptions);
  const modmailState = getModmailState(settings, channelOptions, roleOptions);
  const applicationState = getApplicationState(settings, channelOptions, roleOptions);
  const aiToolsState = getAiToolsState(settings, channelOptions);

  return [
    {
      key: "countdown",
      label: "Countdown",
      enabled: settings.countdownEnabled,
      state:
        !settings.countdownEnabled
          ? "disabled"
          : countdown.state === "upcoming"
            ? "live"
            : countdown.state === "today"
              ? "today"
              : countdown.state === "past"
                ? "ended"
                : "incomplete",
      blocker:
        !settings.countdownEnabled
          ? ""
          : countdownErrors[0] ||
            (countdown.state === "incomplete"
              ? "Add an event name and target date to finish setup."
              : settings.countdownAlertEnabled && countdownAlert.state === "incomplete"
                ? "Select a countdown alert channel before enabling daily alerts."
                : ""),
    },
    {
      key: "welcome",
      label: "Welcome",
      enabled: settings.welcomeEnabled,
      state: getWelcomeState(settings, channelOptions),
      blocker:
        !settings.welcomeEnabled
          ? ""
          : welcomeErrors[0] ||
            (getWelcomeState(settings, channelOptions) === "incomplete"
              ? "Choose a welcome channel and message to finish setup."
              : ""),
    },
    {
      key: "autoRole",
      label: "Auto role",
      enabled: settings.autoRoleEnabled,
      state: getAutoRoleState(settings, roleOptions),
      blocker:
        !settings.autoRoleEnabled
          ? ""
          : autoRoleErrors[0] ||
            (getAutoRoleState(settings, roleOptions) === "incomplete"
              ? "Select a default role to finish setup."
              : ""),
    },
    {
      key: "auditLog",
      label: "Audit log",
      enabled: settings.auditLogEnabled,
      state: getAuditLogState(settings, channelOptions),
      blocker:
        !settings.auditLogEnabled
          ? ""
          : auditLogErrors[0] ||
            (getAuditLogState(settings, channelOptions) === "incomplete"
              ? "Choose a log channel and at least one tracked event."
              : ""),
    },
    {
      key: "autoModeration",
      label: "Automod",
      enabled: settings.autoModerationEnabled,
      state: getAutoModerationState(settings, channelOptions),
      blocker:
        !settings.autoModerationEnabled
          ? ""
          : automodErrors[0] ||
            (getAutoModerationState(settings, channelOptions) === "incomplete"
              ? "Turn on at least one automod rule to finish setup."
              : ""),
    },
    {
      key: "joinScreening",
      label: "Join screening",
      enabled: settings.joinScreeningEnabled,
      state: getJoinScreeningState(settings, channelOptions, roleOptions),
      blocker:
        !settings.joinScreeningEnabled
          ? ""
          : joinScreeningErrors[0] ||
            (getJoinScreeningState(settings, channelOptions, roleOptions) === "incomplete"
              ? "Choose an alert channel and, for quarantine mode, a role."
              : ""),
    },
    {
      key: "announcements",
      label: "Announcements",
      enabled: settings.announcementsEnabled,
      state: getAnnouncementState(settings, channelOptions, mentionRoleOptions),
      blocker:
        !settings.announcementsEnabled
          ? ""
          : announcementErrors[0] ||
            (getAnnouncementState(settings, channelOptions, mentionRoleOptions) === "incomplete"
              ? "Select a destination channel to finish setup."
              : ""),
    },
    {
      key: "starboard",
      label: "Highlights",
      enabled: settings.starboardEnabled,
      state: getStarboardState(settings, channelOptions),
      blocker:
        !settings.starboardEnabled
          ? ""
          : starboardErrors[0] ||
            (getStarboardState(settings, channelOptions) === "incomplete"
              ? "Select a highlight channel to finish setup."
              : ""),
    },
    {
      key: "suggestions",
      label: "Suggestions",
      enabled: settings.suggestionsEnabled,
      state: getSuggestionState(settings, channelOptions),
      blocker:
        !settings.suggestionsEnabled
          ? ""
          : suggestionErrors[0] ||
            (getSuggestionState(settings, channelOptions) === "incomplete"
              ? "Select a public suggestions channel to finish setup."
              : ""),
    },
    {
      key: "reactionRoles",
      label: "Reaction roles",
      enabled: settings.reactionRolesEnabled,
      state: reactionRoleState,
      blocker:
        !settings.reactionRolesEnabled
          ? ""
          : reactionRoleErrors[0] ||
            (reactionRoleState === "incomplete"
              ? "Select a channel, setup message, and role to finish setup."
              : ""),
    },
    {
      key: "tickets",
      label: "Tickets",
      enabled: settings.ticketsEnabled,
      state: ticketState,
      blocker:
        !settings.ticketsEnabled
          ? ""
          : runtimeBlockers.tickets ||
            ticketErrors[0] ||
            (ticketState === "incomplete"
              ? "Select a ticket intake channel to finish setup."
              : ""),
    },
    {
      key: "leveling",
      label: "Leveling",
      enabled: settings.levelingEnabled,
      state: levelingState,
      blocker:
        !settings.levelingEnabled
          ? ""
          : runtimeBlockers.leveling ||
            levelingErrors[0] ||
            (levelingState === "incomplete"
              ? "Select a level-up announcement channel to finish setup."
              : ""),
    },
    {
      key: "antiRaid",
      label: "Anti-raid",
      enabled: settings.antiRaidEnabled,
      state: antiRaidState,
      blocker:
        !settings.antiRaidEnabled
          ? ""
          : antiRaidErrors[0] ||
            (antiRaidState === "incomplete"
              ? "Select an anti-raid alert channel to finish setup."
              : ""),
    },
    {
      key: "automations",
      label: "Automations",
      enabled: settings.automationsEnabled,
      state: automationState,
      blocker:
        !settings.automationsEnabled
          ? ""
          : automationErrors[0] ||
            (automationState === "incomplete"
              ? "Choose a trigger, action, and log channel to finish setup."
              : ""),
    },
    {
      key: "modmail",
      label: "Modmail",
      enabled: settings.modmailEnabled,
      state: modmailState,
      blocker:
        !settings.modmailEnabled
          ? ""
          : modmailErrors[0] ||
            (modmailState === "incomplete"
              ? "Select an inbox channel and staff role to finish setup."
              : ""),
    },
    {
      key: "applications",
      label: "Applications",
      enabled: settings.applicationsEnabled,
      state: applicationState,
      blocker:
        !settings.applicationsEnabled
          ? ""
          : applicationErrors[0] ||
            (applicationState === "incomplete"
              ? "Select a destination channel and reviewer role to finish setup."
              : ""),
    },
    {
      key: "aiTools",
      label: "AI tools",
      enabled: settings.aiToolsEnabled,
      state: aiToolsState,
      blocker:
        !settings.aiToolsEnabled
          ? ""
          : aiToolsErrors[0] ||
            (aiToolsState === "incomplete"
              ? "Select a dedicated AI tools channel to finish setup."
              : ""),
    },
  ];
}

module.exports = {
  DASHBOARD_MODULE_KEYS,
  evaluateDashboardModules,
  getRuntimeModuleValidationErrors,
};

function getRuntimeModuleBlockers(settings = {}) {
  return Object.fromEntries(
    Object.entries(RUNTIME_UNAVAILABLE_MODULES)
      .filter(([moduleKey]) => settings[MODULE_ENABLEMENT_KEYS[moduleKey]])
      .map(([moduleKey, message]) => [moduleKey, message]),
  );
}

function getRuntimeModuleValidationErrors(settings = {}) {
  return Object.values(getRuntimeModuleBlockers(settings));
}

function getModuleState(enabled, state, runtimeBlocker) {
  if (enabled && runtimeBlocker) {
    return "incomplete";
  }

  return state;
}
