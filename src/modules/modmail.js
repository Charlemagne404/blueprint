const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  getRoleLabel,
  normalizeId,
  normalizeText,
} = require("./common");

const defaults = {
  modmailEnabled: false,
  modmailInboxChannelId: "",
  modmailStaffRoleId: "",
  modmailAutoReply: "Thanks for contacting staff. We will reply soon.",
};

function normalizeModmailSettings(input = {}) {
  return {
    modmailEnabled: input.modmailEnabled === true || input.modmailEnabled === "on",
    modmailInboxChannelId: normalizeId(input.modmailInboxChannelId),
    modmailStaffRoleId: normalizeId(input.modmailStaffRoleId),
    modmailAutoReply: normalizeText(
      input.modmailAutoReply,
      "Thanks for contacting staff. We will reply soon.",
      240,
    ),
  };
}

function validateModmailSettings(settings, guild, botMember) {
  if (!settings.modmailEnabled) return [];

  if (!settings.modmailInboxChannelId) {
    return ["Choose a modmail inbox channel before enabling this module."];
  }

  const inbox = guild.channels.cache.get(settings.modmailInboxChannelId);
  if (!inbox) {
    return ["Choose a valid modmail inbox channel in this server."];
  }

  if (botMember && !canSendMessages(inbox, botMember)) {
    return ["Choose a modmail inbox where Blueprint can post incoming messages."];
  }

  if (!settings.modmailStaffRoleId) {
    return ["Select a staff role that can respond to modmail threads."];
  }

  if (!guild.roles.cache.has(settings.modmailStaffRoleId)) {
    return ["Select a valid staff role for modmail access."];
  }

  return [];
}

function getModmailState(settings, channelOptions = [], roleOptions = []) {
  if (!settings.modmailEnabled) return "disabled";
  if (!settings.modmailInboxChannelId || !settings.modmailStaffRoleId) return "incomplete";

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.modmailInboxChannelId)
  ) {
    return "incomplete";
  }

  if (roleOptions.length > 0 && !roleOptions.some((role) => role.id === settings.modmailStaffRoleId)) {
    return "incomplete";
  }

  return "live";
}

function renderModmailModuleCard({ blockerText = "", channelOptions, defaultOpen = false, roleOptions, settings }) {
  const state = getModmailState(settings, channelOptions, roleOptions);
  const statusHtml = `<div class="status-pill status-pill-${state}" data-status-target="modmail">${escapeHtml(getStatusLabel(state))}</div>`;
  const channelOptionsHtml = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `<option value="${escapeHtml(channel.id)}" ${settings.modmailInboxChannelId === channel.id ? "selected" : ""}>${escapeHtml(channel.label)}</option>`),
  ].join("");
  const roleOptionsHtml = [
    `<option value="">Select a role</option>`,
    ...roleOptions.map((role) => `<option value="${escapeHtml(role.id)}" ${settings.modmailStaffRoleId === role.id ? "selected" : ""}>${escapeHtml(role.label)}</option>`),
  ].join("");

  const summaryHtml = renderModuleFacts([
    { label: "Inbox", valueHtml: escapeHtml(getChannelLabel(settings.modmailInboxChannelId, channelOptions)) },
    { label: "Staff role", valueHtml: escapeHtml(getRoleLabel(settings.modmailStaffRoleId, roleOptions)) },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Inbox channel</span>
              <select name="modmailInboxChannelId">${channelOptionsHtml}</select>
            </label>
            <label>
              <span>Staff role</span>
              <select name="modmailStaffRoleId">${roleOptionsHtml}</select>
            </label>
            <label class="module-field-wide">
              <span>DM auto-reply</span>
              <textarea name="modmailAutoReply" rows="3" maxlength="240">${escapeHtml(settings.modmailAutoReply)}</textarea>
            </label>
          </div>
        </div>
        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getPreview(settings, channelOptions, roleOptions, state))}</div>
        </aside>
      </div>
    `,
    checked: settings.modmailEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml: "Route member DMs into a private staff inbox and reply by replying to a forwarded message.",
    eyebrow: "Modmail",
    inputName: "modmailEnabled",
    moduleKey: "modmail",
    moduleId: "modmail",
    statusHtml,
    summaryHtml,
    theme: "tickets",
    titleHtml: "DM support inbox",
  });
}

module.exports = {
  defaults,
  getModmailState,
  normalizeModmailSettings,
  renderModmailModuleCard,
  validateModmailSettings,
};

function getStatusLabel(state) {
  if (state === "live") return "Live";
  if (state === "incomplete") return "Needs setup";
  return "Disabled";
}

function getPreview(settings, channelOptions, roleOptions, state) {
  if (state !== "live") {
    return "Modmail needs an inbox channel and staff role before activation.";
  }

  return `Member DMs are mirrored to ${getChannelLabel(settings.modmailInboxChannelId, channelOptions)}. Staff with ${getRoleLabel(settings.modmailStaffRoleId, roleOptions)} can reply from the inbox.`;
}
