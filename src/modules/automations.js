const { PermissionFlagsBits } = require("discord.js");
const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  isAssignableRole,
  normalizeId,
  normalizeInteger,
  normalizeText,
} = require("./common");

const AUTOMATION_TRIGGERS = ["member_join", "keyword", "suggestion_created"];
const AUTOMATION_ACTIONS = ["send_message", "create_ticket", "assign_role"];

const defaults = {
  automationsEnabled: false,
  automationsLogChannelId: "",
  automationsTrigger: "member_join",
  automationsAction: "send_message",
  automationsKeyword: "",
  automationsCooldownSeconds: 60,
};

function normalizeAutomationSettings(input = {}) {
  return {
    automationsEnabled: input.automationsEnabled === true || input.automationsEnabled === "on",
    automationsLogChannelId: normalizeId(input.automationsLogChannelId),
    automationsTrigger: normalizeOption(input.automationsTrigger, AUTOMATION_TRIGGERS, "member_join"),
    automationsAction: normalizeOption(input.automationsAction, AUTOMATION_ACTIONS, "send_message"),
    automationsKeyword: normalizeText(input.automationsKeyword, "", 80),
    automationsCooldownSeconds: normalizeInteger(input.automationsCooldownSeconds, 60, 0, 3600),
  };
}

function validateAutomationSettings(settings, guild, botMember) {
  if (!settings.automationsEnabled) {
    return [];
  }

  if (!settings.automationsLogChannelId) {
    return ["Choose an automations log channel before enabling this module."];
  }

  const logChannel = guild.channels.cache.get(settings.automationsLogChannelId);
  if (!logChannel) {
    return ["Choose a valid automations log channel in this server."];
  }

  if (botMember && !canSendMessages(logChannel, botMember)) {
    return ["Choose an automations log channel where Blueprint can post rule activity."];
  }

  if (settings.automationsTrigger === "keyword" && !settings.automationsKeyword) {
    return ["Enter a keyword trigger phrase for your automation rule."];
  }

  if (settings.automationsAction === "create_ticket") {
    if (!settings.ticketsEnabled || !settings.ticketsIntakeChannelId) {
      return ["Enable and configure Tickets before using the Create ticket action."];
    }

    const intakeChannel = guild.channels.cache.get(settings.ticketsIntakeChannelId);
    if (!intakeChannel) {
      return ["Choose a valid ticket intake channel for the Create ticket action."];
    }

    if (botMember && !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return ["Blueprint needs Manage Channels permission before an automation can create tickets."];
    }
  }

  if (settings.automationsAction === "assign_role") {
    if (!settings.autoRoleEnabled || !settings.autoRoleRoleId) {
      return ["Enable and configure Auto role before using the Assign role action."];
    }

    const role = guild.roles.cache.get(settings.autoRoleRoleId);
    if (!role || !isAssignableRole(role, botMember)) {
      return ["Choose an assignable Auto role before using the Assign role action."];
    }
  }

  return [];
}

function getAutomationState(settings, channelOptions = []) {
  if (!settings.automationsEnabled) return "disabled";
  if (!settings.automationsLogChannelId) return "incomplete";
  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.automationsLogChannelId)
  ) {
    return "incomplete";
  }

  if (settings.automationsTrigger === "keyword" && !settings.automationsKeyword) {
    return "incomplete";
  }

  if (
    settings.automationsAction === "create_ticket" &&
    (!settings.ticketsEnabled || !settings.ticketsIntakeChannelId ||
      (channelOptions.length > 0 &&
        !channelOptions.some((channel) => channel.id === settings.ticketsIntakeChannelId)))
  ) {
    return "incomplete";
  }

  if (settings.automationsAction === "assign_role" && (!settings.autoRoleEnabled || !settings.autoRoleRoleId)) {
    return "incomplete";
  }

  return "live";
}

function renderAutomationModuleCard({ blockerText = "", channelOptions, defaultOpen = false, settings }) {
  const state = getAutomationState(settings, channelOptions);
  const statusHtml = `<div class="status-pill status-pill-${state}" data-status-target="automations">${escapeHtml(getStatusLabel(state))}</div>`;
  const channelOptionsHtml = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `<option value="${escapeHtml(channel.id)}" ${settings.automationsLogChannelId === channel.id ? "selected" : ""}>${escapeHtml(channel.label)}</option>`),
  ].join("");

  const summaryHtml = renderModuleFacts([
    { label: "Trigger", valueHtml: escapeHtml(readableTrigger(settings.automationsTrigger)) },
    { label: "Action", valueHtml: escapeHtml(readableAction(settings.automationsAction)) },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Trigger</span>
              <select name="automationsTrigger">${AUTOMATION_TRIGGERS.map((trigger) => `<option value="${trigger}" ${settings.automationsTrigger === trigger ? "selected" : ""}>${escapeHtml(readableTrigger(trigger))}</option>`).join("")}</select>
            </label>
            <label>
              <span>Action</span>
              <select name="automationsAction">${AUTOMATION_ACTIONS.map((action) => `<option value="${action}" ${settings.automationsAction === action ? "selected" : ""}>${escapeHtml(readableAction(action))}</option>`).join("")}</select>
            </label>
            <label>
              <span>Log channel</span>
              <select name="automationsLogChannelId">${channelOptionsHtml}</select>
            </label>
            <label>
              <span>Rule cooldown (seconds)</span>
              <input type="number" min="0" max="3600" name="automationsCooldownSeconds" value="${escapeHtml(String(settings.automationsCooldownSeconds))}" />
            </label>
            <label class="module-field-wide ${settings.automationsTrigger === "keyword" ? "" : "is-hidden"}">
              <span>Keyword phrase</span>
              <input type="text" maxlength="80" name="automationsKeyword" value="${escapeHtml(settings.automationsKeyword)}" placeholder="hello team" />
            </label>
          </div>
        </div>
        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getPreview(settings, channelOptions, state))}</div>
        </aside>
      </div>
    `,
    checked: settings.automationsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml: "Build one starter automation rule with trigger, action, and cooldown controls.",
    eyebrow: "Automations",
    inputName: "automationsEnabled",
    moduleKey: "automations",
    moduleId: "automations",
    statusHtml,
    summaryHtml,
    theme: "announcements",
    titleHtml: "Workflow rule builder",
  });
}

module.exports = {
  defaults,
  getAutomationState,
  normalizeAutomationSettings,
  renderAutomationModuleCard,
  validateAutomationSettings,
};

function normalizeOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function readableTrigger(value) {
  if (value === "member_join") return "Member joins";
  if (value === "keyword") return "Keyword matched";
  return "Suggestion created";
}

function readableAction(value) {
  if (value === "send_message") return "Send message";
  if (value === "create_ticket") return "Create ticket";
  return "Assign role";
}

function getStatusLabel(state) {
  if (state === "live") return "Live";
  if (state === "incomplete") return "Needs setup";
  return "Disabled";
}

function getPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Automations need a log channel and valid trigger config before activation.";
  }

  return `${readableTrigger(settings.automationsTrigger)} -> ${readableAction(settings.automationsAction)}. Cooldown ${settings.automationsCooldownSeconds}s. Logged to ${getChannelLabel(settings.automationsLogChannelId, channelOptions)}.`;
}
