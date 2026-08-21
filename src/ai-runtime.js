function validateHttpUrl(name, value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }

  url.hash = "";
  return url;
}

function resolveOptionalBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const url = validateHttpUrl("base URL", trimmed);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function resolveAiBaseUrl(explicitBaseUrl, legacyAskUrl) {
  const explicit = String(explicitBaseUrl || "").trim();
  if (explicit) {
    return resolveOptionalBaseUrl(explicit);
  }

  const legacy = validateHttpUrl("AI_SERVER_URL", legacyAskUrl || "http://localhost:3001/ask");
  legacy.pathname = "";
  legacy.search = "";
  return legacy.toString().replace(/\/$/, "");
}

function resolveServiceUrl(explicitValue, baseUrl, defaultPath, name) {
  const explicit = String(explicitValue || "").trim();
  if (explicit) {
    return validateHttpUrl(name, explicit).toString();
  }
  if (!baseUrl) {
    return "";
  }
  return new URL(defaultPath, `${baseUrl}/`).toString();
}

function resolveAiServiceUrl(name, explicitValue, baseUrl, defaultPath) {
  const resolved = resolveServiceUrl(explicitValue, baseUrl, defaultPath, name);
  if (!resolved || !baseUrl) {
    return resolved;
  }

  const serviceUrl = new URL(resolved);
  const base = new URL(baseUrl);
  if (
    serviceUrl.protocol !== base.protocol ||
    serviceUrl.hostname !== base.hostname ||
    serviceUrl.port !== base.port
  ) {
    throw new Error(
      `${name} must use the same scheme/host/port as AI_SERVER_BASE_URL (${base.origin}).`,
    );
  }

  return serviceUrl.toString();
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseInteger(value, fallback, { minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseOptionalFloat(value, { minimum = -Infinity, maximum = Infinity } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function parseOptionalInteger(value, { minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function extractAiAnswer(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }
  if (!payload || typeof payload !== "object") {
    return "";
  }

  for (const field of ["answer", "response", "message", "text", "output"]) {
    const value = payload[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (payload.data && typeof payload.data === "object") {
    return extractAiAnswer(payload.data);
  }

  return "";
}

function buildAiSessionId(guildId, channelId, userId) {
  return `discord:${guildId || "dm"}:${channelId || 0}:${userId}`;
}

function buildAiOptions(runtimeConfig) {
  const options = {};
  if (runtimeConfig.aiTemperature != null) {
    options.temperature = runtimeConfig.aiTemperature;
  }
  if (runtimeConfig.aiTopP != null) {
    options.top_p = runtimeConfig.aiTopP;
  }
  if (runtimeConfig.aiNumPredict != null) {
    options.num_predict = runtimeConfig.aiNumPredict;
  }
  if (runtimeConfig.aiRepeatPenalty != null) {
    options.repeat_penalty = runtimeConfig.aiRepeatPenalty;
  }
  return options;
}

function buildBackendHeaders(runtimeConfig) {
  const headers = {
    Accept: "application/json",
  };
  if (runtimeConfig.vanguardBackendApiKey) {
    headers[runtimeConfig.vanguardBackendKeyHeader] = runtimeConfig.vanguardBackendApiKey;
  }
  if (runtimeConfig.vanguardInstanceId) {
    headers[runtimeConfig.vanguardInstanceHeader] = runtimeConfig.vanguardInstanceId;
  }
  return headers;
}

function buildAiPrompt(question, persona = "") {
  const trimmedQuestion = String(question || "").trim();
  const trimmedPersona = String(persona || "").trim();
  if (!trimmedPersona) {
    return trimmedQuestion;
  }

  return `Persona: ${trimmedPersona}\n\nUser request:\n${trimmedQuestion}`;
}

function stripBotMention(content, clientUserId) {
  return String(content || "")
    .replaceAll(new RegExp(`<@!?${String(clientUserId || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`, "g"), "")
    .trim();
}

function getAiAccessRequirementMessage(result, runtimeConfig, productName = "Blueprint AI") {
  const payload = result && typeof result === "object" ? result : {};
  if (!payload.configured) {
    return `⛔ ${productName} requires Continental ID integration, but it is not configured on this Blueprint instance.`;
  }

  if (!payload.ok) {
    const message = String(payload.message || "Unknown error").trim();
    return message
      ? `⚠️ I couldn't verify your Continental ID account right now. \`${message}\``
      : "⚠️ I couldn't verify your Continental ID account right now.";
  }

  const body = payload.body && typeof payload.body === "object" ? payload.body : {};
  const access = body.access && typeof body.access === "object" ? body.access : {};
  const aiAccess = access.ai && typeof access.ai === "object" ? access.ai : null;
  const user = body.user && typeof body.user === "object" ? body.user : {};
  const flags = body.flags && typeof body.flags === "object" ? body.flags : {};

  if (aiAccess) {
    if (aiAccess.allowed) {
      return null;
    }

    if (
      Array.isArray(aiAccess.requirements) &&
      aiAccess.requirements.includes("link_discord")
    ) {
      const linkParts = [];
      if (runtimeConfig.authLoginPopupUrl) {
        linkParts.push(`Sign in: ${runtimeConfig.authLoginPopupUrl}`);
      }
      if (runtimeConfig.continentalIdDashboardUrl) {
        linkParts.push(`Dashboard: ${runtimeConfig.continentalIdDashboardUrl}`);
      }

      const suffix = linkParts.length > 0 ? ` ${linkParts.join(" • ")}` : "";
      return `⛔ You must sign in to Continental ID and link your Discord account before you can use ${productName}.${suffix}`.trim();
    }

    if (aiAccess.reasonCode === "auth/authorization-denied") {
      return `⛔ Your Continental ID account is not allowed to use ${productName}.`;
    }
  }

  if (!body.linked || !user.discordLinked) {
    const linkParts = [];
    if (runtimeConfig.authLoginPopupUrl) {
      linkParts.push(`Sign in: ${runtimeConfig.authLoginPopupUrl}`);
    }
    if (runtimeConfig.continentalIdDashboardUrl) {
      linkParts.push(`Dashboard: ${runtimeConfig.continentalIdDashboardUrl}`);
    }

    const suffix = linkParts.length > 0 ? ` ${linkParts.join(" • ")}` : "";
    return `⛔ You must sign in to Continental ID and link your Discord account before you can use ${productName}.${suffix}`.trim();
  }

  if (flags.bannedFromAi) {
    return `⛔ Your Continental ID account is not allowed to use ${productName}.`;
  }

  return null;
}

function isAiRuntimeConfigured(runtimeConfig) {
  return Boolean(
    runtimeConfig.aiAskUrl &&
      runtimeConfig.aiChatUrl &&
      runtimeConfig.aiSessionUrl &&
      runtimeConfig.continentalIdResolveUrl &&
      runtimeConfig.vanguardBackendApiKey,
  );
}

async function resolveContinentalUser(discordUserId, runtimeConfig) {
  const normalizedUserId = String(discordUserId || "").trim();
  if (!normalizedUserId) {
    return {
      body: {},
      configured: Boolean(runtimeConfig.continentalIdResolveUrl),
      linked: false,
      message: "Missing Discord user ID.",
      ok: false,
      statusCode: null,
    };
  }

  if (!runtimeConfig.continentalIdResolveUrl) {
    return {
      body: {},
      configured: false,
      linked: false,
      message: "Continental ID integration is not configured.",
      ok: false,
      statusCode: null,
    };
  }

  try {
    const response = await requestJson(runtimeConfig.continentalIdResolveUrl, {
      body: { discordUserId: normalizedUserId },
      headers: buildBackendHeaders(runtimeConfig),
      method: "POST",
      timeoutMs: 6000,
    });

    return {
      body: response.payload,
      configured: true,
      linked: Boolean(response.payload.linked),
      message: response.ok ? "" : extractErrorMessage(response),
      ok: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      body: {},
      configured: true,
      linked: false,
      message: formatRequestError(error),
      ok: false,
      statusCode: null,
    };
  }
}

async function requestAiReply({ question, persona, runtimeConfig, sessionId, userId, username }) {
  const prompt = buildAiPrompt(question, persona);
  const headers = buildBackendHeaders(runtimeConfig);
  const options = buildAiOptions(runtimeConfig);
  const chatPayload = {
    historyMessages: runtimeConfig.aiHistoryMessages,
    message: prompt,
    sessionId,
    style: runtimeConfig.aiChatStyle,
    useCache: runtimeConfig.aiUseCache,
    useContext: runtimeConfig.aiUseContext,
  };

  if (runtimeConfig.aiModel) {
    chatPayload.model = runtimeConfig.aiModel;
  }
  if (runtimeConfig.aiIncludeDebug) {
    chatPayload.includeDebug = true;
  }
  if (Object.keys(options).length > 0) {
    chatPayload.options = options;
  }

  const askPayload = {
    question: prompt,
    userId: String(userId || ""),
    username: String(username || ""),
  };

  let chatFailure = "";
  try {
    const chatResponse = await requestJson(runtimeConfig.aiChatUrl, {
      body: chatPayload,
      headers,
      method: "POST",
      timeoutMs: runtimeConfig.aiRequestTimeoutSeconds * 1000,
    });
    if (chatResponse.ok) {
      const answer = extractAiAnswer(chatResponse.payload);
      if (answer) {
        return {
          answer,
          mode: "chat",
        };
      }
    } else {
      chatFailure = extractErrorMessage(chatResponse);
    }
  } catch (error) {
    chatFailure = formatRequestError(error);
  }

  try {
    const askResponse = await requestJson(runtimeConfig.aiAskUrl, {
      body: askPayload,
      headers,
      method: "POST",
      timeoutMs: runtimeConfig.aiRequestTimeoutSeconds * 1000,
    });
    if (askResponse.ok) {
      const answer = extractAiAnswer(askResponse.payload) || "No response from the AI service.";
      return {
        answer,
        mode: "compatibility",
      };
    }

    return {
      answer: extractErrorMessage(askResponse) || chatFailure || "AI service returned an error.",
      mode: "error",
    };
  } catch (error) {
    return {
      answer: chatFailure || formatRequestError(error) || "AI service is currently unreachable.",
      mode: "error",
    };
  }
}

async function resetAiSession(sessionId, runtimeConfig) {
  const url = new URL(`${runtimeConfig.aiSessionUrl}/${encodeURIComponent(sessionId)}`);
  try {
    const response = await requestJson(url.toString(), {
      headers: buildBackendHeaders(runtimeConfig),
      method: "DELETE",
      timeoutMs: runtimeConfig.aiRequestTimeoutSeconds * 1000,
    });

    return {
      ok: response.ok || response.status === 404,
      status: response.status,
    };
  } catch (error) {
    return {
      error: formatRequestError(error),
      ok: false,
      status: null,
    };
  }
}

async function requestJson(url, { body, headers = {}, method = "GET", timeoutMs = 6000 } = {}) {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...headers,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  return {
    ok: response.ok,
    payload,
    status: response.status,
    text,
  };
}

function extractErrorMessage(response) {
  const payload = response?.payload;
  if (payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim().slice(0, 240);
  }
  if (response?.status) {
    return `HTTP ${response.status}`;
  }
  return "";
}

function formatRequestError(error) {
  if (error?.name === "TimeoutError") {
    return "The request timed out.";
  }
  if (error?.name === "AbortError") {
    return "The request timed out.";
  }
  return String(error?.message || "Request failed.").trim();
}

module.exports = {
  buildAiOptions,
  buildAiPrompt,
  buildAiSessionId,
  buildBackendHeaders,
  extractAiAnswer,
  getAiAccessRequirementMessage,
  isAiRuntimeConfigured,
  parseBoolean,
  parseInteger,
  parseOptionalFloat,
  parseOptionalInteger,
  requestAiReply,
  resetAiSession,
  resolveAiBaseUrl,
  resolveAiServiceUrl,
  resolveContinentalUser,
  resolveOptionalBaseUrl,
  resolveServiceUrl,
  stripBotMention,
  validateHttpUrl,
};
