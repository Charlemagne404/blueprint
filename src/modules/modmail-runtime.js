const { PermissionFlagsBits } = require("discord.js");

function getModmailReferenceId(message) {
  return String(message?.reference?.messageId || message?.reference?.message_id || "").trim();
}

function canStaffReplyToModmail(message, settings, mapping, member = message?.member) {
  if (
    !message ||
    message.author?.bot ||
    !settings?.modmailEnabled ||
    !mapping ||
    message.guild?.id !== mapping.guildId ||
    message.channelId !== settings.modmailInboxChannelId
  ) {
    return false;
  }

  if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
    return true;
  }

  if (member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  return Boolean(
    settings.modmailStaffRoleId &&
      member?.roles?.cache?.has?.(settings.modmailStaffRoleId),
  );
}

function getModmailReplyContent(message, maxLength = 1800) {
  const content = String(message?.content || "").trim();
  if (!content) {
    return "";
  }

  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

module.exports = {
  canStaffReplyToModmail,
  getModmailReferenceId,
  getModmailReplyContent,
};
