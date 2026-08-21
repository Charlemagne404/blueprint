const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

const {
  clearTicketPanelState,
  closeTicketForChannel,
  closeTicketForUser,
  getTicketByChannel,
  getTicketByUser,
  getTicketPanelState,
  setTicketPanelState,
  upsertTicket,
} = require("../storage");

const OPEN_TICKET_CUSTOM_ID = "tickets:open";
const CLOSE_TICKET_CUSTOM_ID = "tickets:close";
const pendingTicketOpeners = new Set();

function buildTicketPanelPayload(settings) {
  return {
    allowedMentions: { parse: [] },
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(OPEN_TICKET_CUSTOM_ID)
          .setLabel("Open Ticket")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
    content: [
      `🎫 **${settings.ticketsPanelTitle}**`,
      "Press the button below to open a private support channel with the team.",
    ].join("\n"),
  };
}

function buildCloseTicketPayload(openerId) {
  return {
    allowedMentions: { parse: [], users: [openerId] },
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(CLOSE_TICKET_CUSTOM_ID)
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    content: [
      `Support ticket opened for <@${openerId}>.`,
      "Use the button below when the issue is resolved.",
    ].join("\n"),
  };
}

async function syncTicketPanel(guild, settings) {
  if (!settings.ticketsEnabled || !settings.ticketsIntakeChannelId) {
    clearTicketPanelState(guild.id);
    return null;
  }

  const intakeChannel = guild.channels.cache.get(settings.ticketsIntakeChannelId);
  if (!intakeChannel || !intakeChannel.isTextBased()) {
    clearTicketPanelState(guild.id);
    return null;
  }

  const payload = buildTicketPanelPayload(settings);
  const state = getTicketPanelState(guild.id);
  const existingMessage =
    state.panelChannelId === intakeChannel.id && state.panelMessageId
      ? await intakeChannel.messages.fetch(state.panelMessageId).catch(() => null)
      : null;

  if (existingMessage) {
    await existingMessage.edit(payload).catch(() => null);
    return existingMessage;
  }

  const panelMessage = await intakeChannel.send(payload);
  setTicketPanelState(guild.id, intakeChannel.id, panelMessage.id);
  return panelMessage;
}

async function openTicket(interaction, settings, botMember) {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
    return "Tickets can only be opened inside a server.";
  }

  const result = await createTicketForUser(interaction.guild, settings, botMember, interaction.user);
  return result.message;
}

async function createTicketForUser(guild, settings, botMember, user, { context = "" } = {}) {
  if (!guild || !user?.id) {
    return { created: false, message: "Tickets need a valid server member." };
  }

  if (!settings.ticketsEnabled || !settings.ticketsIntakeChannelId) {
    return { created: false, message: "Tickets are disabled in this server." };
  }

  const requestKey = `${guild.id}:${user.id}`;
  if (pendingTicketOpeners.has(requestKey)) {
    return { created: false, message: "This ticket is already being created. Please wait a moment." };
  }

  pendingTicketOpeners.add(requestKey);
  try {
    const existing = getTicketByUser(guild.id, user.id);
    if (existing) {
      const existingChannel = guild.channels.cache.get(existing.channelId);
      if (existingChannel) {
        return {
          created: false,
          existingChannelId: existing.channelId,
          message: `An open ticket already exists in <#${existing.channelId}>.`,
        };
      }

      closeTicketForUser(guild.id, user.id);
    }

    const intakeChannel = guild.channels.cache.get(settings.ticketsIntakeChannelId);
    if (!intakeChannel) {
      return { created: false, message: "The ticket intake channel is no longer available." };
    }

    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { created: false, message: "Blueprint needs Manage Channels permission to open tickets." };
    }

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ];

    if (settings.ticketsSupportRoleId) {
      permissionOverwrites.push({
        id: settings.ticketsSupportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const displayName = user.username || user.tag || user.id;
    const displayTag = user.tag || displayName;
    const ticketChannel = await guild.channels.create({
      name: `ticket-${sanitizeTicketName(displayName)}`,
      parent: intakeChannel.parentId || null,
      permissionOverwrites,
      topic: `Blueprint ticket for ${displayTag} (${user.id})`,
      type: ChannelType.GuildText,
    });

    upsertTicket(guild.id, user.id, ticketChannel.id);

    await ticketChannel.send({
      ...buildCloseTicketPayload(user.id),
      allowedMentions: settings.ticketsSupportRoleId
        ? { parse: [], roles: [settings.ticketsSupportRoleId], users: [user.id] }
        : { parse: [], users: [user.id] },
      content: [
        settings.ticketsSupportRoleId ? `<@&${settings.ticketsSupportRoleId}>` : "",
        `Support ticket opened for <@${user.id}>.`,
        "A team member will be with you shortly. Use the button below when the issue is resolved.",
        context ? `\nContext: ${clampText(context, 1200)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return {
      created: true,
      channel: ticketChannel,
      message: `Ticket created: <#${ticketChannel.id}>.`,
    };
  } catch (error) {
    return {
      created: false,
      error,
      message: "Blueprint could not create the ticket. Please check its channel permissions and try again.",
    };
  } finally {
    pendingTicketOpeners.delete(requestKey);
  }
}

async function closeTicket(interaction, settings) {
  if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
    return "Tickets can only be closed inside a server.";
  }

  const ticket = getTicketByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    return "This channel is not tracked as an open Blueprint ticket.";
  }

  if (!memberCanCloseTicket(interaction, settings, ticket)) {
    return "Only the ticket opener, support role, or server staff can close this ticket.";
  }

  const transcript = await buildTranscript(interaction.channel);
  const transcriptChannel = settings.ticketsTranscriptChannelId
    ? interaction.guild.channels.cache.get(settings.ticketsTranscriptChannelId)
    : null;

  if (transcriptChannel && transcriptChannel.isTextBased()) {
    await transcriptChannel.send({
      allowedMentions: { parse: [] },
      content: [
        `🧾 Ticket closed from #${interaction.channel.name}`,
        `Opened by: <@${ticket.userId}>`,
        "",
        transcript,
      ].join("\n"),
    }).catch(() => null);
  }

  try {
    await interaction.channel.delete("Blueprint ticket closed");
  } catch {
    return "Blueprint could not close this ticket. Please check its channel permissions and try again.";
  }

  closeTicketForChannel(interaction.guild.id, interaction.channel.id);
  return "";
}

function memberCanCloseTicket(interaction, settings, ticket) {
  if (interaction.user.id === ticket.userId) {
    return true;
  }

  if (
    interaction.memberPermissions &&
    (interaction.memberPermissions.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels))
  ) {
    return true;
  }

  if (settings.ticketsSupportRoleId && interaction.member?.roles?.cache?.has(settings.ticketsSupportRoleId)) {
    return true;
  }

  return false;
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) {
    return "(Transcript unavailable)";
  }

  const lines = [...messages.values()]
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((message) => {
      const content = String(message.content || "").trim() || "(no text content)";
      return `${message.author?.tag || "Unknown user"}: ${content}`;
    });

  return clampText(lines.join("\n"), 1800);
}

function sanitizeTicketName(value) {
  const collapsed = String(value || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (collapsed || "member").slice(0, 80);
}

function clampText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

module.exports = {
  CLOSE_TICKET_CUSTOM_ID,
  OPEN_TICKET_CUSTOM_ID,
  buildTicketPanelPayload,
  closeTicket,
  createTicketForUser,
  openTicket,
  sanitizeTicketName,
  syncTicketPanel,
};
