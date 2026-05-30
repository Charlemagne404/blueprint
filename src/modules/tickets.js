const { PermissionFlagsBits } = require("discord.js");
const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  getRoleLabel,
  normalizeId,
  normalizeText,
} = require("./common");

const defaults = {
  ticketsEnabled: false,
  ticketsIntakeChannelId: "",
  ticketsTranscriptChannelId: "",
  ticketsSupportRoleId: "",
  ticketsPanelTitle: "Need help? Open a support ticket.",
};

function normalizeTicketSettings(input = {}) {
  return {
    ticketsEnabled: input.ticketsEnabled === true || input.ticketsEnabled === "on",
    ticketsIntakeChannelId: normalizeId(input.ticketsIntakeChannelId),
    ticketsTranscriptChannelId: normalizeId(input.ticketsTranscriptChannelId),
    ticketsSupportRoleId: normalizeId(input.ticketsSupportRoleId),
    ticketsPanelTitle: normalizeText(input.ticketsPanelTitle, defaults.ticketsPanelTitle, 120),
  };
}

function validateTicketSettings(settings, guild, botMember) {
  if (!settings.ticketsEnabled) {
    return [];
  }

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return ["Blueprint needs Manage Channels permission before tickets can be enabled."];
  }

  if (!settings.ticketsIntakeChannelId) {
    return ["Select a ticket intake channel before enabling this module."];
  }

  const intakeChannel = guild.channels.cache.get(settings.ticketsIntakeChannelId);
  if (!canSendMessages(intakeChannel, botMember)) {
    return ["Choose an intake channel where Blueprint can post the ticket panel."];
  }

  if (settings.ticketsTranscriptChannelId) {
    const transcriptChannel = guild.channels.cache.get(settings.ticketsTranscriptChannelId);
    if (!canSendMessages(transcriptChannel, botMember)) {
      return ["Choose a transcript channel where Blueprint can post ticket logs."];
    }
  }

  if (settings.ticketsSupportRoleId && !guild.roles.cache.has(settings.ticketsSupportRoleId)) {
    return ["Select a valid support role for ticket mentions."];
  }

  return [];
}

function getTicketState(settings, channelOptions = [], roleOptions = []) {
  if (!settings.ticketsEnabled) {
    return "disabled";
  }

  if (!settings.ticketsIntakeChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.ticketsIntakeChannelId)
  ) {
    return "incomplete";
  }

  if (
    settings.ticketsTranscriptChannelId &&
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.ticketsTranscriptChannelId)
  ) {
    return "incomplete";
  }

  if (
    settings.ticketsSupportRoleId &&
    roleOptions.length > 0 &&
    !roleOptions.some((role) => role.id === settings.ticketsSupportRoleId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getTicketStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderTicketModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  mentionRoleOptions = [],
  settings,
}) {
  const state = getTicketState(settings, channelOptions, mentionRoleOptions);
  const intakeOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.ticketsIntakeChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const transcriptOptions = [
    `<option value="">No transcript channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.ticketsTranscriptChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const roleOptions = [
    `<option value="">No support role ping</option>`,
    ...mentionRoleOptions.map((role) => `
      <option value="${escapeHtml(role.id)}" ${
        settings.ticketsSupportRoleId === role.id ? "selected" : ""
      }>
        ${escapeHtml(role.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="tickets">${escapeHtml(getTicketStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Panel channel",
      valueHtml: escapeHtml(getChannelLabel(settings.ticketsIntakeChannelId, channelOptions)),
    },
    {
      label: "Support role",
      valueHtml: escapeHtml(getRoleLabel(settings.ticketsSupportRoleId, mentionRoleOptions)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Ticket panel channel</span>
              <select name="ticketsIntakeChannelId">
                ${intakeOptions}
              </select>
            </label>

            <label>
              <span>Transcript channel</span>
              <select name="ticketsTranscriptChannelId">
                ${transcriptOptions}
              </select>
              <small>Optional private log channel for ticket close summaries.</small>
            </label>

            <label>
              <span>Support role mention</span>
              <select name="ticketsSupportRoleId">
                ${roleOptions}
              </select>
              <small>Optional role ping when a new ticket opens.</small>
            </label>
          </div>

          <label>
            <span>Panel headline</span>
            <input
              name="ticketsPanelTitle"
              maxlength="120"
              value="${escapeHtml(settings.ticketsPanelTitle)}"
            />
          </label>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getTicketPreview(settings, channelOptions, mentionRoleOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Panel feed</span>
              <strong>${escapeHtml(getChannelLabel(settings.ticketsIntakeChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getTicketStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Use dashboard settings for panel text and routing while staff handles tickets in Discord.</p>
        </aside>
      </div>
    `,
    checked: settings.ticketsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Route support requests through a configurable intake panel with optional role alerts and transcript logging.",
    eyebrow: "Tickets",
    inputName: "ticketsEnabled",
    moduleKey: "tickets",
    moduleId: "tickets",
    statusHtml,
    summaryHtml,
    theme: "tickets",
    titleHtml: "Support ticket intake",
  });
}

module.exports = {
  defaults,
  getTicketState,
  getTicketStatusLabel,
  normalizeTicketSettings,
  renderTicketModuleCard,
  validateTicketSettings,
};

function getTicketPreview(settings, channelOptions, mentionRoleOptions, state) {
  if (state !== "live") {
    return "Tickets stay off until an intake channel is selected.";
  }

  const supportRole = getRoleLabel(settings.ticketsSupportRoleId, mentionRoleOptions);
  const transcript = getChannelLabel(settings.ticketsTranscriptChannelId, channelOptions);

  return `Panel posts in ${getChannelLabel(settings.ticketsIntakeChannelId, channelOptions)}. Support mention: ${supportRole}. Transcript logs: ${transcript}.`;
}
