const { ChannelType, PermissionFlagsBits } = require("discord.js");

function normalizeId(value) {
  return /^\d{16,20}$/.test(String(value || "").trim()) ? String(value).trim() : "";
}

function normalizeText(value, fallback, maxLength) {
  const trimmed = String(value || "")
    .trim()
    .slice(0, maxLength);

  return trimmed || fallback;
}

function normalizeInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function splitTextIntoChunks(value, maxLength = 1900) {
  const text = String(value ?? "").trim();
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 1900;
  if (!text) {
    return [];
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < 1) {
      splitAt = remaining.lastIndexOf(" ", limit);
    }
    if (splitAt < 1) {
      splitAt = limit;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function normalizeTextareaList(value, { itemMaxLength = 40, maxItems = 20 } = {}) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/\r?\n|,/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .map((entry) => entry.slice(0, itemMaxLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function isTextChannel(channel) {
  return (
    channel &&
    (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
  );
}

function canSendMessages(channel, botMember) {
  if (!isTextChannel(channel)) {
    return false;
  }

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

function getTextChannelOptions(guild, botMember) {
  return guild.channels.cache
    .filter((channel) => isTextChannel(channel) && canSendMessages(channel, botMember))
    .sort((left, right) => compareChannels(left, right))
    .map((channel) => ({
      id: channel.id,
      label: `#${channel.name}`,
    }));
}

function isAssignableRole(role, botMember) {
  if (!role || role.managed || role.id === role.guild.id) {
    return false;
  }

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return false;
  }

  return botMember.roles.highest.comparePositionTo(role) > 0;
}

function getAssignableRoleOptions(guild, botMember) {
  return guild.roles.cache
    .filter((role) => isAssignableRole(role, botMember))
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
    .map((role) => ({
      id: role.id,
      label: role.name,
    }));
}

function getMentionRoleOptions(guild) {
  return guild.roles.cache
    .filter((role) => role && !role.managed && role.id !== role.guild.id)
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
    .map((role) => ({
      id: role.id,
      label: role.name,
    }));
}

function getChannelLabel(channelId, channelOptions) {
  if (!channelId) {
    return "Not selected";
  }

  return channelOptions.find((channel) => channel.id === channelId)?.label || "Unavailable";
}

function getRoleLabel(roleId, roleOptions) {
  if (!roleId) {
    return "Not selected";
  }

  return roleOptions.find((role) => role.id === roleId)?.label || "Unavailable";
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

module.exports = {
  canSendMessages,
  getAssignableRoleOptions,
  getBotMember,
  getChannelLabel,
  getMentionRoleOptions,
  getRoleLabel,
  getTextChannelOptions,
  isAssignableRole,
  isTextChannel,
  normalizeId,
  normalizeInteger,
  normalizeText,
  normalizeTextareaList,
  splitTextIntoChunks,
};
