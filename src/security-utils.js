"use strict";

const crypto = require("node:crypto");

function normalizeReturnTo(value, fallback = "/dashboard") {
  const raw = String(value || "").trim();
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(raw)
  ) {
    return fallback;
  }

  return raw;
}

function tokensMatch(expectedToken, submittedToken) {
  if (!expectedToken || !submittedToken) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const submitted = Buffer.from(submittedToken);
  return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
}

module.exports = {
  normalizeReturnTo,
  tokensMatch,
};
