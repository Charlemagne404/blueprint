"use strict";

const SERVICE_NAME = "blueprint";
const MAX_TEXT_LENGTH = 500;

function info(event, context = {}) {
  writeLog("info", event, context);
}

function warn(event, context = {}) {
  writeLog("warn", event, context);
}

function error(event, context = {}, cause = null) {
  writeLog("error", event, {
    ...context,
    ...(cause ? { error: serializeError(cause) } : {}),
  });
}

function writeLog(level, event, context) {
  const entry = buildLogEntry(level, event, context);
  const output = `${JSON.stringify(entry)}\n`;

  if (level === "error") {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
}

function buildLogEntry(level, event, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    event: sanitizeText(event, "unknown_event"),
    ...sanitizeValue(context),
  };
}

function serializeError(cause) {
  if (!cause || typeof cause !== "object") {
    return { message: sanitizeText(cause, "Unknown error") };
  }

  const serialized = {
    name: sanitizeText(cause.name, "Error", 80),
    message: sanitizeText(cause.message, "Unknown error"),
  };

  for (const key of ["code", "status", "statusCode", "type"]) {
    if (cause[key] !== undefined && cause[key] !== null) {
      serialized[key] = sanitizeValue(cause[key]);
    }
  }

  if (process.env.NODE_ENV !== "production" && cause.stack) {
    serialized.stack = sanitizeText(cause.stack, "", 2000);
  }

  return serialized;
}

function sanitizeValue(value, key = "") {
  if (isSensitiveKey(key)) {
    return "[REDACTED]";
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeValue(entryValue, entryKey),
        ]),
    );
  }

  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

function sanitizeText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  const text = String(value ?? fallback)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:access[_-]?token|api[_-]?key|client[_-]?secret|password|secret|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(authorization\s*[:=]\s*)[^,\s]+/gi, "$1[REDACTED]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
    .trim();

  return text ? text.slice(0, maxLength) : fallback;
}

function isSensitiveKey(key) {
  return /^(?:access[_-]?token|api[_-]?key|authorization|content|cookie|message|password|prompt|secret|session|token)$/i.test(
    String(key),
  );
}

module.exports = {
  buildLogEntry,
  error,
  info,
  serializeError,
  warn,
};
