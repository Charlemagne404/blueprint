const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLogEntry } = require("../src/logger");

test("structured log entries redact credentials and sensitive payload fields", () => {
  const entry = buildLogEntry("error", "auth_failed", {
    accessToken: "secret-token",
    authorization: "Bearer secret-token",
    error: new Error("request failed?token=secret-token"),
    guildId: "123456789012345678",
    prompt: "private AI prompt",
  });

  assert.equal(entry.service, "blueprint");
  assert.equal(entry.accessToken, "[REDACTED]");
  assert.equal(entry.authorization, "[REDACTED]");
  assert.equal(entry.prompt, "[REDACTED]");
  assert.equal(entry.guildId, "123456789012345678");
  assert.doesNotMatch(JSON.stringify(entry), /secret-token|private AI prompt/);
});
