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

function getModmailInboundContent(message, maxLength = 1600) {
  const text = String(message?.content || "").trim() || "(no text content)";
  const attachments = getSafeAttachmentUrls(message)
    .slice(0, 5)
    .map((url) => `Attachment: ${url}`);
  const content = [text, ...attachments].join("\n");

  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getSafeAttachmentUrls(message) {
  const values = typeof message?.attachments?.values === "function"
    ? [...message.attachments.values()]
    : Array.isArray(message?.attachments)
      ? message.attachments
      : [];

  return values
    .map((attachment) => String(attachment?.url || attachment?.proxyURL || "").trim())
    .filter((url) => {
      try {
        return ["http:", "https:"].includes(new URL(url).protocol);
      } catch {
        return false;
      }
    });
}

module.exports = {
  canStaffReplyToModmail,
  getModmailReferenceId,
  getModmailInboundContent,
  getModmailReplyContent,
};
