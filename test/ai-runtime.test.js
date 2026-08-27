const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAiPrompt,
  buildAiSessionId,
  extractAiAnswer,
  getAiAccessRequirementMessage,
  parseBoolean,
  parseInteger,
  parseOptionalInteger,
  resolveAiBaseUrl,
  resolveAiServiceUrl,
  stripBotMention,
} = require("../src/ai-runtime");

test("AI base URL derives from the legacy ask endpoint", () => {
  assert.equal(resolveAiBaseUrl("", "http://localhost:3001/ask"), "http://localhost:3001");
});

test("AI service overrides must stay on the AI base origin", () => {
  assert.throws(
    () =>
      resolveAiServiceUrl(
        "AI_SESSION_URL",
        "http://localhost:3006/session",
        "http://localhost:3001",
        "/session",
      ),
    /same scheme\/host\/port/i,
  );
});

test("AI helpers normalize answers and session ids", () => {
  assert.equal(extractAiAnswer({ answer: "Top level" }), "Top level");
  assert.equal(extractAiAnswer({ data: { response: "Nested" } }), "Nested");
  assert.equal(buildAiSessionId("123", "456", "789"), "discord:123:456:789");
});

test("AI access messages require a linked Continental ID account", () => {
  const message = getAiAccessRequirementMessage(
    {
      body: {
        flags: {},
        linked: false,
        user: {
          discordLinked: false,
        },
      },
      configured: true,
      ok: true,
    },
    {
      authLoginPopupUrl: "https://login.continental-hub.com/popup.html",
      continentalIdDashboardUrl: "https://dashboard.continental-hub.com/?tab=settings",
    },
    "Blueprint AI",
  );

  assert.match(message, /sign in to continental id/i);
  assert.match(message, /dashboard/i);
});

test("AI access messages block AI-banned accounts", () => {
  const message = getAiAccessRequirementMessage(
    {
      body: {
        flags: { bannedFromAi: true },
        linked: true,
        user: {
          discordLinked: true,
        },
      },
      configured: true,
      ok: true,
    },
    {},
    "Blueprint AI",
  );

  assert.equal(message, "⛔ Your Continental ID account is not allowed to use Blueprint AI.");
});

test("AI access messages prefer centralized access policy when present", () => {
  const deniedMessage = getAiAccessRequirementMessage(
    {
      body: {
        access: {
          ai: {
            allowed: false,
            reasonCode: "auth/authorization-denied",
            requirements: [],
          },
        },
        flags: {},
        linked: true,
        user: {
          discordLinked: true,
        },
      },
      configured: true,
      ok: true,
    },
    {},
    "Blueprint AI",
  );

  assert.equal(deniedMessage, "⛔ Your Continental ID account is not allowed to use Blueprint AI.");
});

test("AI prompt helpers preserve persona and strip mentions", () => {
  assert.equal(
    buildAiPrompt("Summarize the rules", "Helpful and concise community copilot"),
    "Persona: Helpful and concise community copilot\n\nUser request:\nSummarize the rules",
  );
  assert.equal(stripBotMention("<@123> hello <@!123>", "123"), "hello");
  assert.equal(parseBoolean("on", false), true);
});

test("AI numeric parsers keep intentional zero values", () => {
  assert.equal(parseInteger(0, 60, { minimum: 0, maximum: 3600 }), 0);
  assert.equal(parseOptionalInteger(0, { minimum: 0, maximum: 3600 }), 0);
});
