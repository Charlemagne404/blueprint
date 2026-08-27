const { PermissionFlagsBits } = require("discord.js");

const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
  normalizeTextareaList,
} = require("./common");

const defaults = {
  autoModerationEnabled: false,
  autoModerationLogChannelId: "",
  autoModerationBlockInvites: true,
  autoModerationBlockedWords: [],
  autoModerationMentionLimit: 5,
  autoModerationTimeoutMinutes: 0,
};

function normalizeAutoModerationSettings(input = {}) {
  return {
    autoModerationEnabled:
      input.autoModerationEnabled === true || input.autoModerationEnabled === "on",
    autoModerationLogChannelId: normalizeId(input.autoModerationLogChannelId),
    autoModerationBlockInvites:
      input.autoModerationBlockInvites === true || input.autoModerationBlockInvites === "on",
    autoModerationBlockedWords: normalizeTextareaList(input.autoModerationBlockedWords, {
      itemMaxLength: 40,
      maxItems: 25,
    }),
    autoModerationMentionLimit: normalizeInteger(input.autoModerationMentionLimit, 5, 0, 25),
    autoModerationTimeoutMinutes: normalizeInteger(input.autoModerationTimeoutMinutes, 0, 0, 10_080),
  };
}

function validateAutoModerationSettings(settings, guild, botMember) {
  if (!settings.autoModerationEnabled) {
    return [];
  }

  if (!hasAtLeastOneAutoModerationRule(settings)) {
    return ["Turn on at least one automod rule before enabling this module."];
  }

  if (!botMember) {
    return ["Blueprint could not verify its moderation permissions in this server."];
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return ["Blueprint needs Manage Messages before automod can remove flagged posts."];
  }

  if (
    settings.autoModerationTimeoutMinutes > 0 &&
    !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)
  ) {
    return ["Blueprint needs Moderate Members before automod can apply timeouts."];
  }

  if (settings.autoModerationLogChannelId) {
    const channel = guild.channels.cache.get(settings.autoModerationLogChannelId);
    if (!canSendMessages(channel, botMember)) {
      return ["Choose an automod log channel where Blueprint can post moderation notices."];
    }
  }

  return [];
}

function getAutoModerationState(settings, channelOptions = []) {
  if (!settings.autoModerationEnabled) {
    return "disabled";
  }

  if (!hasAtLeastOneAutoModerationRule(settings)) {
    return "incomplete";
  }

  if (
    settings.autoModerationLogChannelId &&
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.autoModerationLogChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAutoModerationStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderAutoModerationModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getAutoModerationState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">No log channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.autoModerationLogChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="autoModeration">${escapeHtml(getAutoModerationStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Rules",
      valueHtml: escapeHtml(getAutoModerationRuleSummary(settings)),
    },
    {
      label: "Action",
      valueHtml: escapeHtml(
        settings.autoModerationTimeoutMinutes > 0
          ? `Delete + ${settings.autoModerationTimeoutMinutes}m timeout`
          : "Delete only",
      ),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label class="module-field-wide">
              <span>Blocked words</span>
              <textarea
                name="autoModerationBlockedWords"
                rows="5"
                maxlength="1200"
                placeholder="slur-one&#10;slur-two&#10;spoiler phrase"
              >${escapeHtml(settings.autoModerationBlockedWords.join("\n"))}</textarea>
              <small>One phrase per line. Matching is case-insensitive.</small>
            </label>

            <label>
              <span>Mention limit</span>
              <input
                type="number"
                min="0"
                max="25"
                name="autoModerationMentionLimit"
                value="${escapeHtml(String(settings.autoModerationMentionLimit))}"
              />
              <small>Set to <code>0</code> to ignore mention spam.</small>
            </label>

            <label>
              <span>Timeout minutes</span>
              <input
                type="number"
                min="0"
                max="10080"
                name="autoModerationTimeoutMinutes"
                value="${escapeHtml(String(settings.autoModerationTimeoutMinutes))}"
              />
              <small>Set to <code>0</code> to only delete matched posts.</small>
            </label>

            <label>
              <span>Automod log channel</span>
              <select name="autoModerationLogChannelId">
                ${channelSelectOptions}
              </select>
            </label>
          </div>

          <div class="subsection">
            <span class="subsection-label">Rules</span>
            <label class="checkbox-chip checkbox-chip-block">
              <input
                type="checkbox"
                name="autoModerationBlockInvites"
                value="on"
                ${settings.autoModerationBlockInvites ? "checked" : ""}
              />
              <span>Block Discord invite links</span>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAutoModerationPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Logs</span>
              <strong>${escapeHtml(getChannelLabel(settings.autoModerationLogChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAutoModerationStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Staff with management permissions are exempted automatically.</p>
        </aside>
      </div>
    `,
    checked: settings.autoModerationEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Remove invite links, blocked phrases, and mention spam before they derail the server.",
    eyebrow: "Automod",
    inputName: "autoModerationEnabled",
    moduleKey: "autoModeration",
    moduleId: "auto-moderation",
    statusHtml,
    summaryHtml,
    theme: "auto-moderation",
    titleHtml: "Content moderation rules",
  });
}

async function moderateMessage(message, settings) {
  if (
    !settings.autoModerationEnabled ||
    !message.guild ||
    !message.member ||
    message.author.bot ||
    shouldSkipMember(message.member)
  ) {
    return { moderated: false, reasons: [] };
  }

  const reasons = collectModerationReasons(message, settings);
  if (reasons.length === 0) {
    return { moderated: false, reasons: [] };
  }

  if (message.deletable) {
    await message.delete().catch(() => null);
  }

  let timedOut = false;
  if (settings.autoModerationTimeoutMinutes > 0 && message.member.moderatable) {
    try {
      await message.member.timeout(
        settings.autoModerationTimeoutMinutes * 60 * 1000,
        `Blueprint automod: ${reasons.join(", ")}`,
      );
      timedOut = true;
    } catch {
      timedOut = false;
    }
  }

  const logChannel = message.guild.channels.cache.get(settings.autoModerationLogChannelId);
  const botMember = await message.guild.members.fetchMe().catch(() => message.guild.members.me || null);
  if (canSendMessages(logChannel, botMember)) {
    await logChannel.send({
      allowedMentions: { parse: [] },
      content: [
        `Automod removed a message from ${message.author.tag} (${message.author.id})`,
        `Channel: <#${message.channelId}>`,
        `Reason: ${reasons.join(", ")}`,
        `Content: ${summarizeMessageContent(message.content)}`,
      ].join("\n"),
    }).catch(() => null);
  }

  return {
    moderated: true,
    reasons,
    timedOut,
  };
}

module.exports = {
  defaults,
  getAutoModerationState,
  getAutoModerationStatusLabel,
  moderateMessage,
  normalizeAutoModerationSettings,
  renderAutoModerationModuleCard,
  validateAutoModerationSettings,
};

function hasAtLeastOneAutoModerationRule(settings) {
  return Boolean(
    settings.autoModerationBlockInvites ||
      settings.autoModerationBlockedWords.length > 0 ||
      settings.autoModerationMentionLimit > 0,
  );
}

function getAutoModerationRuleSummary(settings) {
  const rules = [];
  if (settings.autoModerationBlockInvites) {
    rules.push("Invite links");
  }
  if (settings.autoModerationBlockedWords.length > 0) {
    rules.push(`${settings.autoModerationBlockedWords.length} blocked phrase${
      settings.autoModerationBlockedWords.length === 1 ? "" : "s"
    }`);
  }
  if (settings.autoModerationMentionLimit > 0) {
    rules.push(`${settings.autoModerationMentionLimit}+ mentions`);
  }

  return rules.join(", ") || "Not configured";
}

function getAutoModerationPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Automod stays off until at least one rule is active and Blueprint can remove matched messages.";
  }

  return `Blueprint blocks ${getAutoModerationRuleSummary(settings).toLowerCase()} and posts notices in ${getChannelLabel(
    settings.autoModerationLogChannelId,
    channelOptions,
  )}.`;
}

function shouldSkipMember(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages)
  );
}

function collectModerationReasons(message, settings) {
  const content = String(message.content || "").toLowerCase();
  const reasons = [];

  if (
    settings.autoModerationBlockInvites &&
    /(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(content)
  ) {
    reasons.push("invite link");
  }

  if (
    settings.autoModerationBlockedWords.length > 0 &&
    settings.autoModerationBlockedWords.some((phrase) => content.includes(phrase))
  ) {
    reasons.push("blocked phrase");
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (settings.autoModerationMentionLimit > 0 && mentionCount >= settings.autoModerationMentionLimit) {
    reasons.push("mention spam");
  }

  return reasons;
}

function summarizeMessageContent(content) {
  const raw = String(content || "").trim();
  if (!raw) {
    return "Unavailable";
  }

  return raw.length > 260 ? `${raw.slice(0, 257)}...` : raw;
}
