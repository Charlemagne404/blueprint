"use strict";

function createRateLimiter({
  keyGenerator = (request) => request.ip || "anonymous",
  limit = 10,
  maxKeys = 10_000,
  now = () => Date.now(),
  onReject = () => {},
  windowMs = 60_000,
} = {}) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeMaxKeys = Math.max(1, Number(maxKeys) || 1);
  const safeWindowMs = Math.max(1_000, Number(windowMs) || 1_000);
  const entries = new Map();

  function prune(currentTime) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= currentTime) {
        entries.delete(key);
      }
    }

    while (entries.size > safeMaxKeys) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      entries.delete(oldestKey);
    }
  }

  function middleware(request, response, next) {
    const currentTime = now();
    prune(currentTime);
    const key = String(keyGenerator(request) || "anonymous").slice(0, 256);
    let entry = entries.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + safeWindowMs };
      entries.set(key, entry);
    }

    if (entry.count >= safeLimit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - currentTime) / 1000),
      );
      response.set("Retry-After", String(retryAfterSeconds));
      response.set("X-RateLimit-Limit", String(safeLimit));
      response.status(429);
      try {
        onReject({ key, retryAfterSeconds });
      } catch {
        // Metrics and logging hooks must never break the limiter itself.
      }

      if (request.accepts("html")) {
        response.send("Too many requests. Please try again shortly.");
        return;
      }

      response.json({
        message: "Too many requests. Please try again shortly.",
        retryAfterSeconds,
      });
      return;
    }

    entry.count += 1;
    response.set("X-RateLimit-Limit", String(safeLimit));
    next();
  }

  return {
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
    middleware,
  };
}

module.exports = {
  createRateLimiter,
};
