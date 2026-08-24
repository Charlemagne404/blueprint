const DEFAULT_ANTI_RAID_SLOWMODE_SECONDS = 10;

function createCooldownStore({
  getExpiry = () => 0,
  now = () => Date.now(),
  onBlocked = () => {},
  setExpiry = () => {},
} = {}) {
  const cooldowns = new Map();

  return {
    clear() {
      cooldowns.clear();
    },
    consume(key, cooldownSeconds) {
      const normalizedCooldownSeconds = Math.max(0, Number(cooldownSeconds) || 0);
      if (normalizedCooldownSeconds === 0) {
        cooldowns.delete(key);
        try {
          setExpiry(key, 0);
        } catch {
          // Persistence is a safety enhancement; it must not break the action.
        }
        return true;
      }

      const currentTime = now();
      let expiresAt = cooldowns.get(key) || 0;
      if (!expiresAt) {
        try {
          expiresAt = Number(getExpiry(key)) || 0;
        } catch {
          expiresAt = 0;
        }
      }
      if (expiresAt > currentTime) {
        try {
          onBlocked(key);
        } catch {
          // Metrics and logging hooks must never break the cooldown itself.
        }
        return false;
      }

      const nextExpiry = currentTime + normalizedCooldownSeconds * 1000;
      cooldowns.set(key, nextExpiry);
      try {
        setExpiry(key, nextExpiry);
      } catch {
        // The in-memory cooldown remains active if persistence is unavailable.
      }
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
