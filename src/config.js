const path = require("node:path");

require("dotenv").config();

const {
  parseBoolean,
  parseInteger,
  parseOptionalFloat,
  parseOptionalInteger,
  resolveAiBaseUrl,
  resolveAiServiceUrl,
  resolveOptionalBaseUrl,
  resolveServiceUrl,
  validateHttpUrl,
} = require("./ai-runtime");

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_AUTH_API_BASE_URL = "http://localhost:5000";
const DEFAULT_AUTH_LOGIN_POPUP_URL = "https://login.continental-hub.com/popup.html";
const DEFAULT_CONTINENTAL_ID_DASHBOARD_URL = "https://dashboard.continental-hub.com/?tab=settings";
const DEFAULT_AI_SERVER_URL = "http://localhost:3001/ask";
const isProduction = process.env.NODE_ENV === "production";

const authApiBaseUrl = resolveOptionalBaseUrl(
  process.env.AUTH_API_BASE_URL || DEFAULT_AUTH_API_BASE_URL,
);
const aiServerBaseUrl = resolveAiBaseUrl(
  process.env.AI_SERVER_BASE_URL || "",
  process.env.AI_SERVER_URL || DEFAULT_AI_SERVER_URL,
);
const continentalIdBaseUrl = resolveOptionalBaseUrl(
  process.env.CONTINENTAL_ID_BASE_URL || authApiBaseUrl,
);
const continentalIdAuthBaseUrl =
  resolveOptionalBaseUrl(process.env.CONTINENTAL_ID_AUTH_BASE_URL || "") || authApiBaseUrl;
const aiIntegrationConfigured = Boolean(
  process.env.AI_SERVER_BASE_URL ||
    process.env.AI_SERVER_URL ||
    process.env.AI_ASK_URL ||
    process.env.AI_CHAT_URL ||
    process.env.AI_SESSION_URL ||
    process.env.CONTINENTAL_ID_RESOLVE_URL,
);
const authTrustedLoginOrigins = String(
  process.env.AUTH_TRUSTED_LOGIN_ORIGINS || "",
)
  .split(",")
  .map((value) => value.trim())
  .map(normalizeTrustedLoginOrigin)
  .filter(Boolean);

const config = {
  aiAskUrl: resolveAiServiceUrl("AI_ASK_URL", process.env.AI_ASK_URL || "", aiServerBaseUrl, "/ask"),
  aiChatStyle: (() => {
    const value = String(process.env.AI_CHAT_STYLE || "balanced").trim().toLowerCase();
    return ["concise", "balanced", "detailed"].includes(value) ? value : "balanced";
  })(),
  aiChatUrl: resolveAiServiceUrl("AI_CHAT_URL", process.env.AI_CHAT_URL || "", aiServerBaseUrl, "/chat"),
  aiHealthUrl: resolveAiServiceUrl("AI_HEALTH_URL", process.env.AI_HEALTH_URL || "", aiServerBaseUrl, "/health"),
  aiHistoryMessages: parseInteger(process.env.AI_HISTORY_MESSAGES, 12, { minimum: 1, maximum: 24 }),
  aiIntegrationConfigured,
  aiIncludeDebug: parseBoolean(process.env.AI_INCLUDE_DEBUG, false),
  aiModel: String(process.env.AI_MODEL || "").trim() || "",
  aiModelsUrl: resolveAiServiceUrl("AI_MODELS_URL", process.env.AI_MODELS_URL || "", aiServerBaseUrl, "/models"),
  aiNumPredict: parseOptionalInteger(process.env.AI_NUM_PREDICT, { minimum: 1, maximum: 4096 }),
  aiRepeatPenalty: parseOptionalFloat(process.env.AI_REPEAT_PENALTY, { minimum: 0.8, maximum: 2 }),
  aiRequestTimeoutSeconds: parseInteger(process.env.AI_REQUEST_TIMEOUT_SECONDS, 60, { minimum: 2, maximum: 120 }),
  aiRequestCooldownSeconds: parseInteger(process.env.AI_USER_COOLDOWN_SECONDS, 10, {
    minimum: 0,
    maximum: 120,
  }),
  aiServerBaseUrl,
  aiSessionUrl: resolveAiServiceUrl("AI_SESSION_URL", process.env.AI_SESSION_URL || "", aiServerBaseUrl, "/session"),
  aiTemperature: parseOptionalFloat(process.env.AI_TEMPERATURE, { minimum: 0, maximum: 2 }),
  aiTopP: parseOptionalFloat(process.env.AI_TOP_P, { minimum: 0, maximum: 1 }),
  aiUseCache: parseBoolean(process.env.AI_USE_CACHE, true),
  aiUseContext: parseBoolean(process.env.AI_USE_CONTEXT, true),
  authApiBaseUrl,
  authRequestTimeoutSeconds: parseInteger(process.env.AUTH_REQUEST_TIMEOUT_SECONDS, 10, {
    minimum: 2,
    maximum: 60,
  }),
  authRateLimitMaxRequests: parseInteger(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10, {
    minimum: 1,
    maximum: 1000,
  }),
  authRateLimitWindowSeconds: parseInteger(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS, 60, {
    minimum: 1,
    maximum: 3600,
  }),
  authLoginPopupUrl:
    process.env.AUTH_LOGIN_POPUP_URL || DEFAULT_AUTH_LOGIN_POPUP_URL,
  authTrustedLoginOrigins,
  baseUrl: (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
  clientId: process.env.DISCORD_CLIENT_ID,
  continentalIdAuthBaseUrl,
  continentalIdBaseUrl,
  continentalIdDashboardUrl:
    String(process.env.CONTINENTAL_ID_DASHBOARD_URL || DEFAULT_CONTINENTAL_ID_DASHBOARD_URL).trim(),
  continentalIdHealthUrl: resolveServiceUrl(
    process.env.CONTINENTAL_ID_HEALTH_URL || "",
    continentalIdBaseUrl,
    "/api/vanguard/health",
    "CONTINENTAL_ID_HEALTH_URL",
  ),
  continentalIdLoginUrl:
    String(process.env.CONTINENTAL_ID_LOGIN_URL || DEFAULT_AUTH_LOGIN_POPUP_URL).trim(),
  continentalIdResolveUrl: resolveServiceUrl(
    process.env.CONTINENTAL_ID_RESOLVE_URL || "",
    continentalIdBaseUrl,
    "/api/vanguard/users/resolve",
    "CONTINENTAL_ID_RESOLVE_URL",
  ),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")),
  guildId: process.env.DISCORD_GUILD_ID,
  isProduction,
  metricsToken: String(process.env.METRICS_TOKEN || "").trim(),
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "blueprint.sid",
  sessionSecret: process.env.DISCORD_SESSION_SECRET,
  token: process.env.DISCORD_TOKEN,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, isProduction ? 1 : 0),
  dashboardWriteRateLimitMaxRequests: parseInteger(
    process.env.DASHBOARD_WRITE_RATE_LIMIT_MAX_REQUESTS,
    30,
    { minimum: 1, maximum: 1000 },
  ),
  dashboardWriteRateLimitWindowSeconds: parseInteger(
    process.env.DASHBOARD_WRITE_RATE_LIMIT_WINDOW_SECONDS,
    60,
    { minimum: 1, maximum: 3600 },
  ),
  vanguardBackendApiKey: String(
    process.env.VANGUARD_BACKEND_API_KEY || process.env.VANGUARD_API_KEY || "",
  ).trim(),
  vanguardBackendKeyHeader:
    String(process.env.VANGUARD_BACKEND_KEY_HEADER || "X-Vanguard-Api-Key").trim() ||
    "X-Vanguard-Api-Key",
  vanguardInstanceHeader:
    String(process.env.VANGUARD_INSTANCE_HEADER || "X-Vanguard-Instance-Id").trim() ||
    "X-Vanguard-Instance-Id",
  vanguardInstanceId: String(process.env.VANGUARD_INSTANCE_ID || "").trim(),
};

config.authCompleteUrl = `${config.baseUrl}/auth/complete`;

function validateRuntimeConfig(runtimeConfig = config) {
  const errors = [];
  const warnings = [];

  if (!runtimeConfig.token) {
    errors.push("DISCORD_TOKEN is required.");
  }
  if (!runtimeConfig.clientId) {
    errors.push("DISCORD_CLIENT_ID is required.");
  }
  if (!runtimeConfig.sessionSecret) {
    errors.push("DISCORD_SESSION_SECRET is required.");
  }
  if (!Number.isInteger(runtimeConfig.port) || runtimeConfig.port < 1 || runtimeConfig.port > 65535) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }

  validateUrl("BASE_URL", runtimeConfig.baseUrl, errors);
  validateUrl("AUTH_API_BASE_URL", runtimeConfig.authApiBaseUrl, errors);
  validateUrl("AUTH_LOGIN_POPUP_URL", runtimeConfig.authLoginPopupUrl, errors);
  validateUrl("AI_SERVER_BASE_URL", runtimeConfig.aiServerBaseUrl, errors);
  validateUrl("AI_ASK_URL", runtimeConfig.aiAskUrl, errors);
  validateUrl("AI_CHAT_URL", runtimeConfig.aiChatUrl, errors);
  validateUrl("AI_SESSION_URL", runtimeConfig.aiSessionUrl, errors);
  validateUrl("CONTINENTAL_ID_AUTH_BASE_URL", runtimeConfig.continentalIdAuthBaseUrl, errors);
  validateUrl("CONTINENTAL_ID_LOGIN_URL", runtimeConfig.continentalIdLoginUrl, errors);
  validateUrl("CONTINENTAL_ID_DASHBOARD_URL", runtimeConfig.continentalIdDashboardUrl, errors);
  validateUrl("CONTINENTAL_ID_RESOLVE_URL", runtimeConfig.continentalIdResolveUrl, errors);

  if (runtimeConfig.isProduction) {
    if (!runtimeConfig.baseUrl.startsWith("https://")) {
      errors.push("BASE_URL must use HTTPS when NODE_ENV=production.");
    }
    if (!runtimeConfig.authApiBaseUrl.startsWith("https://")) {
      errors.push("AUTH_API_BASE_URL must use HTTPS when NODE_ENV=production.");
    }
    if (!runtimeConfig.authLoginPopupUrl.startsWith("https://")) {
      errors.push("AUTH_LOGIN_POPUP_URL must use HTTPS when NODE_ENV=production.");
    }
    if (runtimeConfig.trustProxy < 1) {
      errors.push("TRUST_PROXY must be at least 1 when NODE_ENV=production.");
    }
    if (runtimeConfig.authApiBaseUrl === DEFAULT_AUTH_API_BASE_URL) {
      errors.push("AUTH_API_BASE_URL must be set explicitly when NODE_ENV=production.");
    }
    if (String(runtimeConfig.sessionSecret || "").length < 32) {
      errors.push("DISCORD_SESSION_SECRET must be at least 32 characters when NODE_ENV=production.");
    }
    if (runtimeConfig.aiIntegrationConfigured && !runtimeConfig.vanguardBackendApiKey) {
      errors.push("VANGUARD_BACKEND_API_KEY is required when NODE_ENV=production.");
    }
    if (String(runtimeConfig.metricsToken || "").length < 32) {
      errors.push("METRICS_TOKEN must be at least 32 characters when NODE_ENV=production.");
    }
  } else if (String(runtimeConfig.sessionSecret || "").length > 0 && String(runtimeConfig.sessionSecret).length < 32) {
    warnings.push("DISCORD_SESSION_SECRET should be at least 32 characters before production deployment.");
  }

  validateTrustedLoginOrigins(runtimeConfig.authTrustedLoginOrigins, runtimeConfig.isProduction, errors);

  return { errors, warnings };
}

function parseTrustProxy(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "on"].includes(normalized)) {
    return 1;
  }
  if (["false", "no", "off"].includes(normalized)) {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10 ? parsed : fallback;
}

function validateTrustedLoginOrigins(origins, production, errors) {
  for (const origin of origins || []) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
        errors.push(`AUTH_TRUSTED_LOGIN_ORIGINS contains an invalid origin: ${origin}`);
        continue;
      }
      if (production && url.protocol !== "https:") {
        errors.push(`AUTH_TRUSTED_LOGIN_ORIGINS must use HTTPS in production: ${origin}`);
      }
    } catch {
      errors.push(`AUTH_TRUSTED_LOGIN_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
}

function normalizeTrustedLoginOrigin(value) {
  try {
    const url = new URL(value);
    if (url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password) {
      return url.origin;
    }
  } catch {
    // Keep invalid values intact so validation reports the configured value.
  }

  return value;
}

function validateUrl(name, value, errors) {
  try {
    validateHttpUrl(name, value);
  } catch (error) {
    errors.push(error.message || `${name} must be a valid URL.`);
  }
}

config.validateRuntimeConfig = validateRuntimeConfig;

module.exports = config;
