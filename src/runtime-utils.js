const DEFAULT_ANTI_RAID_SLOWMODE_SECONDS = 10;

function createCooldownStore({ now = () => Date.now() } = {}) {
  const cooldowns = new Map();

  return {
    clear() {
      cooldowns.clear();
    },
    consume(key, cooldownSeconds) {
      const normalizedCooldownSeconds = Math.max(0, Number(cooldownSeconds) || 0);
      if (normalizedCooldownSeconds === 0) {
        cooldowns.delete(key);
        return true;
      }

      const currentTime = now();
      const expiresAt = cooldowns.get(key) || 0;
      if (expiresAt > currentTime) {
        return false;
      }

      cooldowns.set(key, currentTime + normalizedCooldownSeconds * 1000);
      return true;
    },
  };
}

function getLockdownSlowmodeSeconds(
  currentSlowmodeSeconds,
  lockdownSlowmodeSeconds = DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
) {
  const normalizedCurrent = Math.max(0, Number(currentSlowmodeSeconds) || 0);
  const normalizedLockdown = Math.max(0, Number(lockdownSlowmodeSeconds) || 0);
  return Math.max(normalizedCurrent, normalizedLockdown);
}

module.exports = {
  DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
  createCooldownStore,
  getLockdownSlowmodeSeconds,
};
