const { PermissionFlagsBits } = require("discord.js");

const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
} = require("./common");

const defaults = {
  antiRaidEnabled: false,
  antiRaidAlertChannelId: "",
  antiRaidJoinThreshold: 8,
  antiRaidWindowSeconds: 20,
  antiRaidLockdownMinutes: 10,
};

function normalizeAntiRaidSettings(input = {}) {
  return {
    antiRaidEnabled: input.antiRaidEnabled === true || input.antiRaidEnabled === "on",
    antiRaidAlertChannelId: normalizeId(input.antiRaidAlertChannelId),
    antiRaidJoinThreshold: normalizeInteger(input.antiRaidJoinThreshold, 8, 2, 100),
    antiRaidWindowSeconds: normalizeInteger(input.antiRaidWindowSeconds, 20, 5, 300),
    antiRaidLockdownMinutes: normalizeInteger(input.antiRaidLockdownMinutes, 10, 1, 240),
  };
}

function validateAntiRaidSettings(settings, guild, botMember) {
  if (!settings.antiRaidEnabled) {
    return [];
  }

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return ["Blueprint needs Manage Channels before anti-raid lockdown can run."];
  }

  if (!settings.antiRaidAlertChannelId) {
    return ["Choose an alert channel before enabling anti-raid."];
  }

  const alertChannel = guild.channels.cache.get(settings.antiRaidAlertChannelId);
  if (!canSendMessages(alertChannel, botMember)) {
    return ["Choose an alert channel where Blueprint can post anti-raid warnings."];
  }

  return [];
}

function getAntiRaidState(settings, channelOptions = []) {
  if (!settings.antiRaidEnabled) {
    return "disabled";
  }

  if (!settings.antiRaidAlertChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.antiRaidAlertChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAntiRaidStatusLabel(state) {
  if (state === "live") return "Live";
  if (state === "incomplete") return "Needs setup";
  return "Disabled";
}

function renderAntiRaidModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getAntiRaidState(settings, channelOptions);
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="antiRaid">${escapeHtml(getAntiRaidStatusLabel(state))}</div>
  `;
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.antiRaidAlertChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");

  const summaryHtml = renderModuleFacts([
    {
      label: "Alert feed",
      valueHtml: escapeHtml(getChannelLabel(settings.antiRaidAlertChannelId, channelOptions)),
    },
    {
      label: "Threshold",
      valueHtml: escapeHtml(`${settings.antiRaidJoinThreshold} joins / ${settings.antiRaidWindowSeconds}s`),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Alert channel</span>
              <select name="antiRaidAlertChannelId">${channelSelectOptions}</select>
            </label>

            <label>
              <span>Join spike threshold</span>
              <input
                type="number"
                min="2"
                max="100"
                name="antiRaidJoinThreshold"
                value="${escapeHtml(String(settings.antiRaidJoinThreshold))}"
              />
            </label>

            <label>
              <span>Detection window (seconds)</span>
              <input
                type="number"
                min="5"
                max="300"
                name="antiRaidWindowSeconds"
                value="${escapeHtml(String(settings.antiRaidWindowSeconds))}"
              />
            </label>

            <label>
              <span>Lockdown duration (minutes)</span>
              <input
                type="number"
                min="1"
                max="240"
                name="antiRaidLockdownMinutes"
                value="${escapeHtml(String(settings.antiRaidLockdownMinutes))}"
              />
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAntiRaidPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Threshold</span>
              <strong>${escapeHtml(String(settings.antiRaidJoinThreshold))} joins</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAntiRaidStatusLabel(state))}</strong>
            </div>
          </div>
        </aside>
      </div>
    `,
    checked: settings.antiRaidEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml: "Detect rapid join spikes and temporarily lock channels during incidents.",
    eyebrow: "Anti-raid",
    inputName: "antiRaidEnabled",
    moduleKey: "antiRaid",
    moduleId: "anti-raid",
    statusHtml,
    summaryHtml,
    theme: "auto-moderation",
    titleHtml: "Raid detection and lockdown",
  });
}

module.exports = {
  defaults,
  getAntiRaidState,
  getAntiRaidStatusLabel,
  normalizeAntiRaidSettings,
  renderAntiRaidModuleCard,
  validateAntiRaidSettings,
};

function getAntiRaidPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Anti-raid requires an alert channel before activation.";
  }

  return `If ${settings.antiRaidJoinThreshold} members join in ${settings.antiRaidWindowSeconds}s, Blueprint starts a ${settings.antiRaidLockdownMinutes} minute lockdown and reports to ${getChannelLabel(settings.antiRaidAlertChannelId, channelOptions)}.`;
}
