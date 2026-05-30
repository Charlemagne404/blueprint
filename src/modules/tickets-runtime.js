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
  getTicketByChannel,
  getTicketByUser,
  getTicketPanelState,
  setTicketPanelState,
  upsertTicket,
} = require("../storage");

const OPEN_TICKET_CUSTOM_ID = "tickets:open";
const CLOSE_TICKET_CUSTOM_ID = "tickets:close";

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

  if (!settings.ticketsEnabled || !settings.ticketsIntakeChannelId) {
    return "Tickets are disabled in this server.";
  }

  const guild = interaction.guild;
  const existing = getTicketByUser(guild.id, interaction.user.id);
  if (existing) {
    const existingChannel = guild.channels.cache.get(existing.channelId);
    if (existingChannel) {
      return `You already have an open ticket in <#${existing.channelId}>.`;
    }
  }

  const intakeChannel = guild.channels.cache.get(settings.ticketsIntakeChannelId);
  if (!intakeChannel) {
    return "The ticket intake channel is no longer available.";
  }

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return "Blueprint needs Manage Channels permission to open tickets.";
  }

  const everyoneRoleId = guild.roles.everyone.id;
  const permissionOverwrites = [
    {
      id: everyoneRoleId,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
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

  const channelName = `ticket-${sanitizeTicketName(interaction.user.username)}`;
  const ticketChannel = await guild.channels.create({
    name: channelName,
    parent: intakeChannel.parentId || null,
    permissionOverwrites,
    topic: `Blueprint ticket for ${interaction.user.tag} (${interaction.user.id})`,
    type: ChannelType.GuildText,
  });

  upsertTicket(guild.id, interaction.user.id, ticketChannel.id);

  await ticketChannel.send({
    ...buildCloseTicketPayload(interaction.user.id),
    allowedMentions: settings.ticketsSupportRoleId
      ? { parse: [], roles: [settings.ticketsSupportRoleId], users: [interaction.user.id] }
      : { parse: [], users: [interaction.user.id] },
    content: [
      settings.ticketsSupportRoleId ? `<@&${settings.ticketsSupportRoleId}>` : "",
      `Support ticket opened for <@${interaction.user.id}>.`,
      "A team member will be with you shortly. Use the button below when the issue is resolved.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return `Ticket created: <#${ticketChannel.id}>.`;
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

  closeTicketForChannel(interaction.guild.id, interaction.channel.id);
  await interaction.channel.delete("Blueprint ticket closed").catch(() => null);
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
  openTicket,
  sanitizeTicketName,
  syncTicketPanel,
};
