const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../src/config");

function productionConfig(overrides = {}) {
  return {
    ...config,
    aiAskUrl: "https://ai.example.test/ask",
    aiChatUrl: "https://ai.example.test/chat",
    aiSessionUrl: "https://ai.example.test/session",
    aiServerBaseUrl: "https://ai.example.test",
    authApiBaseUrl: "https://auth.example.test",
    authLoginPopupUrl: "https://login.example.test/popup.html",
    authTrustedLoginOrigins: ["https://blueprint.example.test"],
    aiIntegrationConfigured: true,
    baseUrl: "https://blueprint.example.test",
    continentalIdAuthBaseUrl: "https://auth.example.test",
    continentalIdDashboardUrl: "https://dashboard.example.test/settings",
    continentalIdLoginUrl: "https://login.example.test/popup.html",
    continentalIdResolveUrl: "https://auth.example.test/api/users/resolve",
    isProduction: true,
    sessionSecret: "a-realistic-session-secret-that-is-long-enough",
    token: "discord-token",
    clientId: "123456789012345678",
    trustProxy: 1,
    vanguardBackendApiKey: "vanguard-key",
    ...overrides,
  };
}

test("production config rejects insecure auth endpoints and missing backend keys", () => {
  const result = config.validateRuntimeConfig(
    productionConfig({
      authApiBaseUrl: "http://auth.example.test",
      vanguardBackendApiKey: "",
    }),
  );

  assert.match(result.errors.join("\n"), /AUTH_API_BASE_URL must use HTTPS/);
  assert.match(result.errors.join("\n"), /VANGUARD_BACKEND_API_KEY is required/);
});

test("production config requires a trusted TLS proxy hop", () => {
  const result = config.validateRuntimeConfig(productionConfig({ trustProxy: 0 }));

  assert.match(result.errors.join("\n"), /TRUST_PROXY must be at least 1/);
});

test("production config rejects trusted login values that are not origins", () => {
  const result = config.validateRuntimeConfig(
    productionConfig({
      authTrustedLoginOrigins: ["https://blueprint.example.test/login"],
    }),
  );

  assert.match(result.errors.join("\n"), /contains an invalid origin/);
});

test("production config accepts a complete HTTPS deployment shape", () => {
  const result = config.validateRuntimeConfig(productionConfig({
    aiIntegrationConfigured: false,
  }));

  assert.deepEqual(result.errors, []);
});
