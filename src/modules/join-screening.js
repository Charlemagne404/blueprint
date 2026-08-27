const { PermissionFlagsBits } = require("discord.js");

const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  getRoleLabel,
  isAssignableRole,
  normalizeId,
  normalizeInteger,
  normalizeText,
} = require("./common");

const SCREENING_ACTIONS = [
  { value: "flag", label: "Flag only" },
  { value: "kick", label: "Kick new account" },
  { value: "quarantine", label: "Assign quarantine role" },
];

const defaults = {
  joinScreeningEnabled: false,
  joinScreeningAlertChannelId: "",
  joinScreeningMinAccountAgeDays: 7,
  joinScreeningAction: "flag",
  joinScreeningQuarantineRoleId: "",
};

function normalizeJoinScreeningSettings(input = {}) {
  return {
    joinScreeningEnabled:
      input.joinScreeningEnabled === true || input.joinScreeningEnabled === "on",
    joinScreeningAlertChannelId: normalizeId(input.joinScreeningAlertChannelId),
    joinScreeningMinAccountAgeDays: normalizeInteger(
      input.joinScreeningMinAccountAgeDays,
      defaults.joinScreeningMinAccountAgeDays,
      1,
      365,
    ),
    joinScreeningAction: normalizeJoinScreeningAction(input.joinScreeningAction),
    joinScreeningQuarantineRoleId: normalizeId(input.joinScreeningQuarantineRoleId),
  };
}

function validateJoinScreeningSettings(settings, guild, botMember) {
  if (!settings.joinScreeningEnabled) {
    return [];
  }

  if (!settings.joinScreeningAlertChannelId) {
    return ["Select an alert channel so staff can review screening matches."];
  }

  const alertChannel = guild.channels.cache.get(settings.joinScreeningAlertChannelId);
  if (!canSendMessages(alertChannel, botMember)) {
    return ["Choose a join screening alert channel where Blueprint can send notices."];
  }

  if (!botMember) {
    return ["Blueprint could not verify its moderation permissions in this server."];
  }

  if (settings.joinScreeningAction === "kick") {
    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
      return ["Blueprint needs Kick Members before join screening can remove suspicious accounts."];
    }
  }

  if (settings.joinScreeningAction === "quarantine") {
    if (!settings.joinScreeningQuarantineRoleId) {
      return ["Select a quarantine role before using the assign-role screening action."];
    }

    const role = guild.roles.cache.get(settings.joinScreeningQuarantineRoleId);
    if (!isAssignableRole(role, botMember)) {
      return ["The selected quarantine role is not assignable by Blueprint."];
    }
  }

  return [];
}

function getJoinScreeningState(settings, channelOptions = [], roleOptions = []) {
  if (!settings.joinScreeningEnabled) {
    return "disabled";
  }

  if (!settings.joinScreeningAlertChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.joinScreeningAlertChannelId)
  ) {
    return "incomplete";
  }

  if (
    settings.joinScreeningAction === "quarantine" &&
    (!settings.joinScreeningQuarantineRoleId ||
      (roleOptions.length > 0 &&
        !roleOptions.some((role) => role.id === settings.joinScreeningQuarantineRoleId)))
  ) {
    return "incomplete";
  }

  return "live";
}

function getJoinScreeningStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderJoinScreeningModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  roleOptions,
  settings,
}) {
  const state = getJoinScreeningState(settings, channelOptions, roleOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.joinScreeningAlertChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const roleSelectOptions = [
    `<option value="">Select a role</option>`,
    ...roleOptions.map((role) => `
      <option value="${escapeHtml(role.id)}" ${
        settings.joinScreeningQuarantineRoleId === role.id ? "selected" : ""
      }>
        ${escapeHtml(role.label)}
      </option>
    `),
  ].join("");
  const actionOptions = SCREENING_ACTIONS.map((action) => `
    <option value="${action.value}" ${
      settings.joinScreeningAction === action.value ? "selected" : ""
    }>
      ${escapeHtml(action.label)}
    </option>
  `).join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="joinScreening">${escapeHtml(getJoinScreeningStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Minimum age",
      valueHtml: escapeHtml(`${settings.joinScreeningMinAccountAgeDays} day${
        settings.joinScreeningMinAccountAgeDays === 1 ? "" : "s"
      }`),
    },
    {
      label: "Action",
      valueHtml: escapeHtml(getJoinScreeningActionLabel(settings.joinScreeningAction)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Alert channel</span>
              <select name="joinScreeningAlertChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Minimum account age (days)</span>
              <input
                type="number"
                min="1"
                max="365"
                name="joinScreeningMinAccountAgeDays"
                value="${escapeHtml(String(settings.joinScreeningMinAccountAgeDays))}"
              />
            </label>

            <label>
              <span>When an account is too new</span>
              <select name="joinScreeningAction">
                ${actionOptions}
              </select>
            </label>

            <label>
              <span>Quarantine role</span>
              <select name="joinScreeningQuarantineRoleId">
                ${roleSelectOptions}
              </select>
              <small>Only used when the action is set to assign a quarantine role.</small>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getJoinScreeningPreview(settings, channelOptions, roleOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Alerts</span>
              <strong>${escapeHtml(getChannelLabel(settings.joinScreeningAlertChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getJoinScreeningStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">This module only checks human accounts when they join.</p>
        </aside>
      </div>
    `,
    checked: settings.joinScreeningEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Flag or contain newly-created Discord accounts before they reach the rest of the server.",
    eyebrow: "Join screening",
    inputName: "joinScreeningEnabled",
    moduleKey: "joinScreening",
    moduleId: "join-screening",
    statusHtml,
    summaryHtml,
    theme: "join-screening",
    titleHtml: "Account-age gate",
  });
}

async function screenNewMember(member, settings) {
  if (!settings.joinScreeningEnabled || member.user.bot) {
    return { preventedOnboarding: false, triggered: false };
  }

  const accountAgeDays = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000),
  );
  if (accountAgeDays >= settings.joinScreeningMinAccountAgeDays) {
    return { preventedOnboarding: false, triggered: false };
  }

  let actionResult = "Flagged for staff review.";
  let preventedOnboarding = false;

  if (settings.joinScreeningAction === "kick") {
    if (!member.kickable) {
      actionResult = "Blueprint could not kick the member because of Discord role hierarchy.";
    } else {
      try {
        await member.kick("Blueprint join screening");
        actionResult = "Member was kicked automatically.";
        preventedOnboarding = true;
      } catch {
        actionResult = "Blueprint could not kick the member; staff review is required.";
      }
    }
  } else if (settings.joinScreeningAction === "quarantine") {
    const role = member.guild.roles.cache.get(settings.joinScreeningQuarantineRoleId);
    if (!role) {
      actionResult = "The configured quarantine role is no longer available.";
    } else {
      try {
        await member.roles.add(role, "Blueprint join screening");
        actionResult = `Assigned quarantine role ${role.name}.`;
        preventedOnboarding = true;
      } catch {
        actionResult = "Blueprint could not assign the quarantine role; staff review is required.";
      }
    }
  }

  const alertChannel = member.guild.channels.cache.get(settings.joinScreeningAlertChannelId);
  const botMember = await member.guild.members.fetchMe().catch(() => member.guild.members.me || null);
  if (canSendMessages(alertChannel, botMember)) {
    await alertChannel.send({
      allowedMentions: { parse: [] },
      content: [
        `Join screening match: ${member.user.tag} (${member.id})`,
        `Account age: ${accountAgeDays} day${accountAgeDays === 1 ? "" : "s"}`,
        `Threshold: ${settings.joinScreeningMinAccountAgeDays} day${
          settings.joinScreeningMinAccountAgeDays === 1 ? "" : "s"
        }`,
        `Action: ${actionResult}`,
        `Created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
      ].join("\n"),
    }).catch(() => null);
  }

  return {
    preventedOnboarding,
    triggered: true,
  };
}

module.exports = {
  defaults,
  getJoinScreeningState,
  getJoinScreeningStatusLabel,
  normalizeJoinScreeningSettings,
  renderJoinScreeningModuleCard,
  screenNewMember,
  validateJoinScreeningSettings,
};

function normalizeJoinScreeningAction(value) {
  const normalized = normalizeText(value, defaults.joinScreeningAction, 20);
  return SCREENING_ACTIONS.some((action) => action.value === normalized)
    ? normalized
    : defaults.joinScreeningAction;
}

function getJoinScreeningActionLabel(value) {
  return SCREENING_ACTIONS.find((action) => action.value === value)?.label || "Flag only";
}

function getJoinScreeningPreview(settings, channelOptions, roleOptions, state) {
  if (state !== "live") {
    return "Join screening needs an alert channel and, for quarantine mode, a role Blueprint can assign.";
  }

  const actionLabel =
    settings.joinScreeningAction === "quarantine"
      ? `${getJoinScreeningActionLabel(settings.joinScreeningAction)} (${getRoleLabel(
          settings.joinScreeningQuarantineRoleId,
          roleOptions,
        )})`
      : getJoinScreeningActionLabel(settings.joinScreeningAction);

  return `Accounts newer than ${settings.joinScreeningMinAccountAgeDays} day${
    settings.joinScreeningMinAccountAgeDays === 1 ? "" : "s"
  } are sent to ${getChannelLabel(
    settings.joinScreeningAlertChannelId,
    channelOptions,
  )} and handled with ${actionLabel.toLowerCase()}.`;
}
