"use strict";

const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;

async function readResponseText(response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES) {
  const safeMaxBytes = Math.max(1, Number(maxBytes) || DEFAULT_MAX_RESPONSE_BYTES);
  const reader = response?.body?.getReader?.();

  if (!reader) {
    const text = await response.text();
    assertResponseSize(text, safeMaxBytes);
    return text;
  }

  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      const chunk = Buffer.from(result.value || []);
      totalBytes += chunk.byteLength;
      if (totalBytes > safeMaxBytes) {
        await reader.cancel();
        throw createResponseTooLargeError(safeMaxBytes);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks).toString("utf8");
}

function assertResponseSize(text, maxBytes) {
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw createResponseTooLargeError(maxBytes);
  }
}

function createResponseTooLargeError(maxBytes) {
  const error = new Error(`Response body exceeds the ${maxBytes}-byte limit.`);
  error.code = "response_too_large";
  return error;
}

module.exports = {
  DEFAULT_MAX_RESPONSE_BYTES,
  readResponseText,
};
