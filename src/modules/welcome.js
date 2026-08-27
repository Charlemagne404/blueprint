const { ChannelType, PermissionFlagsBits } = require("discord.js");

const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");

const defaults = {
  welcomeEnabled: false,
  welcomeChannelId: "",
  welcomeMessageTemplate: "Welcome to {server}, {mention}.",
};

function normalizeWelcomeSettings(input = {}) {
  return {
    welcomeEnabled: input.welcomeEnabled === true || input.welcomeEnabled === "on",
    welcomeChannelId: normalizeId(input.welcomeChannelId),
    welcomeMessageTemplate: normalizeText(
      input.welcomeMessageTemplate,
      defaults.welcomeMessageTemplate,
      400,
    ),
  };
}

function getWelcomeChannelOptions(guild, botMember) {
  return guild.channels.cache
    .filter((channel) => isWelcomeChannel(channel) && canSendWelcomeMessage(channel, botMember))
    .sort((left, right) => compareChannels(left, right))
    .map((channel) => ({
      id: channel.id,
      label: `#${channel.name}`,
    }));
}

function validateWelcomeSettings(settings, guild, botMember) {
  if (!settings.welcomeEnabled) {
    return [];
  }

  if (!settings.welcomeChannelId) {
    return ["Select a welcome channel before enabling welcome messages."];
  }

  const channel = guild.channels.cache.get(settings.welcomeChannelId);
  if (!isWelcomeChannel(channel)) {
    return ["The selected welcome channel no longer exists or cannot receive messages."];
  }

  if (!botMember) {
    return ["Blueprint could not verify its bot permissions in this server."];
  }

  const permissions = channel.permissionsFor(botMember);
  if (
    !permissions ||
    !permissions.has(PermissionFlagsBits.ViewChannel) ||
    !permissions.has(PermissionFlagsBits.SendMessages)
  ) {
    return ["Blueprint needs View Channel and Send Messages in the selected welcome channel."];
  }

  return [];
}

function renderWelcomeModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  guildName,
  settings,
}) {
  const state = getWelcomeState(settings, channelOptions);
  const preview = buildWelcomePreview(settings, guildName, channelOptions, state);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.welcomeChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="welcome">${escapeHtml(getWelcomeStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Destination",
      valueHtml: escapeHtml(preview.channelLabel),
    },
    {
      label: "Audience",
      valueHtml: "New human members",
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Welcome channel</span>
              <select name="welcomeChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label class="module-field-wide">
              <span>Welcome message</span>
              <textarea
                name="welcomeMessageTemplate"
                rows="5"
                maxlength="400"
                placeholder="Welcome to {server}, {mention}."
              >${escapeHtml(settings.welcomeMessageTemplate)}</textarea>
              <small>Use <code>{mention}</code>, <code>{user}</code>, <code>{displayName}</code>, and <code>{server}</code>.</small>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module preview</span>
          <div class="countdown-preview">${escapeHtml(preview.message).replaceAll("\n", "<br />")}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Destination</span>
              <strong>${escapeHtml(preview.channelLabel)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getWelcomeStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">${escapeHtml(preview.note)}</p>
        </aside>
      </div>
    `,
    checked: settings.welcomeEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Post a configurable welcome message in one channel whenever a human member joins.",
    eyebrow: "Welcome",
    inputName: "welcomeEnabled",
    moduleKey: "welcome",
    moduleId: "welcome",
    statusHtml,
    summaryHtml,
    theme: "welcome",
    titleHtml: "New member greeting",
  });
}

async function sendWelcomeMessage(member, settings) {
  if (!settings.welcomeEnabled || member.user.bot) {
    return;
  }

  const channel = member.guild.channels.cache.get(settings.welcomeChannelId);
  if (!isWelcomeChannel(channel)) {
    return;
  }

  const botMember = await getBotMember(member.guild, member.client.user.id);
  const errors = validateWelcomeSettings(settings, member.guild, botMember);
  if (errors.length > 0) {
    return;
  }

  await channel.send(buildWelcomeMessagePayload(member, settings));
}

module.exports = {
  buildWelcomeMessagePayload,
  defaults,
  getWelcomeChannelOptions,
  getWelcomeState,
  getWelcomeStatusLabel,
  normalizeWelcomeSettings,
  renderWelcomeModuleCard,
  sendWelcomeMessage,
  validateWelcomeSettings,
};

function buildWelcomeMessagePayload(member, settings) {
  return {
    allowedMentions: {
      parse: [],
      users: member?.id ? [member.id] : [],
    },
    content: renderTemplate(settings.welcomeMessageTemplate, {
      displayName: member.displayName,
      mention: member?.id ? `<@${member.id}>` : "new member",
      server: member.guild.name,
      user: member.user.username,
    }),
  };
}

function buildWelcomePreview(settings, guildName, channelOptions, state) {
  return {
    channelLabel: getChannelLabel(settings.welcomeChannelId, channelOptions),
    message:
      state === "live"
        ? renderTemplate(settings.welcomeMessageTemplate, {
            displayName: "New Member",
            mention: "@new-member",
            server: guildName,
            user: "newmember",
          })
        : "Welcome messages are disabled until this module is enabled and fully configured.",
    note:
      state === "live"
        ? "Bot accounts are skipped automatically."
        : "Choose a text channel and message template to finish setup.",
  };
}

function getWelcomeState(settings, channelOptions = []) {
  if (!settings.welcomeEnabled) {
    return "disabled";
  }

  if (!settings.welcomeChannelId || !normalizeText(settings.welcomeMessageTemplate, "", 400)) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.welcomeChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getWelcomeStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function getChannelLabel(channelId, channelOptions) {
  if (!channelId) {
    return "Not selected";
  }

  return channelOptions.find((channel) => channel.id === channelId)?.label || "Unavailable";
}

function renderTemplate(template, values) {
  return String(template || "")
    .replaceAll("{mention}", values.mention)
    .replaceAll("{displayName}", values.displayName)
    .replaceAll("{user}", values.user)
    .replaceAll("{server}", values.server);
}

function normalizeId(value) {
  return /^\d{16,20}$/.test(String(value || "").trim()) ? String(value).trim() : "";
}

function normalizeText(value, fallback, maxLength) {
  const trimmed = String(value || "")
    .trim()
    .slice(0, maxLength);

  return trimmed || fallback;
}

function isWelcomeChannel(channel) {
  return (
    channel &&
    (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
  );
}

function canSendWelcomeMessage(channel, botMember) {
  if (!botMember) {
    return true;
  }

  const permissions = channel.permissionsFor(botMember);
  return (
    permissions &&
    permissions.has(PermissionFlagsBits.ViewChannel) &&
    permissions.has(PermissionFlagsBits.SendMessages)
  );
}

function compareChannels(left, right) {
  const positionDelta = left.rawPosition - right.rawPosition;
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.name.localeCompare(right.name);
}

async function getBotMember(guild, clientUserId) {
  if (guild.members.me) {
    return guild.members.me;
  }

  try {
    return await guild.members.fetch(clientUserId);
  } catch {
    return null;
  }
}
