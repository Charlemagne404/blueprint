const { getLevelingMemberStats, upsertLevelingMemberStats } = require("../storage");

const LEVEL_XP_FACTOR = 100;
const levelingMemberQueues = new Map();

function enqueueLevelingTask(key, task) {
  const previous = levelingMemberQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);

  levelingMemberQueues.set(key, current);
  current
    .finally(() => {
      if (levelingMemberQueues.get(key) === current) {
        levelingMemberQueues.delete(key);
      }
    })
    .catch(() => undefined);

  return current;
}

function getXpRequiredForLevel(level) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  return normalizedLevel * normalizedLevel * LEVEL_XP_FACTOR;
}

function getLevelFromXp(xp) {
  const normalizedXp = Math.max(0, Number(xp) || 0);
  return Math.floor(Math.sqrt(normalizedXp / LEVEL_XP_FACTOR));
}

function shouldGrantLevelingXp(lastMessageAt, cooldownSeconds, now = new Date()) {
  if (!lastMessageAt) {
    return true;
  }

  const lastTimestamp = Date.parse(lastMessageAt);
  if (Number.isNaN(lastTimestamp)) {
    return true;
  }

  return now.getTime() - lastTimestamp >= Math.max(0, cooldownSeconds) * 1000;
}

function renderLevelUpMessage(template, member, level) {
  return String(template || "")
    .replaceAll("{mention}", `<@${member.user.id}>`)
    .replaceAll("{user}", member.user.username)
    .replaceAll("{level}", String(level));
}

async function processLevelingMessage(message, settings) {
  if (
    !settings.levelingEnabled ||
    !message.guild ||
    !message.author ||
    !message.member ||
    message.author.bot
  ) {
    return null;
  }

  const announceChannel = message.guild.channels.cache.get(settings.levelingAnnounceChannelId);
  if (!announceChannel || !announceChannel.isTextBased()) {
    return null;
  }

  return enqueueLevelingTask(`${message.guild.id}:${message.author.id}`, async () => {
    const now = new Date();
    const current = getLevelingMemberStats(message.guild.id, message.author.id);
    if (!shouldGrantLevelingXp(current.lastMessageAt, settings.levelingCooldownSeconds, now)) {
      return null;
    }

    const nextXp = current.xp + settings.levelingXpPerMessage;
    const nextLevel = getLevelFromXp(nextXp);
    const leveledUp = nextLevel > current.level;

    upsertLevelingMemberStats(message.guild.id, message.author.id, {
      lastMessageAt: now.toISOString(),
      level: nextLevel,
      xp: nextXp,
    });

    if (!leveledUp) {
      return {
        level: nextLevel,
        leveledUp: false,
        xp: nextXp,
      };
    }

    await announceChannel.send({
      allowedMentions: { parse: [], users: [message.author.id] },
      content: renderLevelUpMessage(settings.levelingLevelUpMessage, message.member, nextLevel),
    });

    return {
      level: nextLevel,
      leveledUp: true,
      xp: nextXp,
    };
  });
}

module.exports = {
  LEVEL_XP_FACTOR,
  enqueueLevelingTask,
  getLevelFromXp,
  getXpRequiredForLevel,
  processLevelingMessage,
  renderLevelUpMessage,
  shouldGrantLevelingXp,
};
