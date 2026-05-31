const AUTH_POPUP_NAME = "continental-id-login";
const AUTH_POPUP_MESSAGE_SOURCE = "continental-id";
const AUTH_POPUP_MESSAGE_TYPE = "auth-result";

const AUTH_ERROR_CODE = Object.freeze({
  accessTokenMissing: "auth/access-token-missing",
  authorizationDenied: "auth/authorization-denied",
  invalidAccessToken: "auth/invalid-access-token",
  messageInvalid: "auth/message-invalid",
  messageOriginRejected: "auth/message-origin-rejected",
  popupBlocked: "auth/popup-blocked",
  popupClosed: "auth/popup-closed",
  sessionMissing: "auth/session-missing",
  sessionSyncFailed: "auth/session-sync-failed",
  unavailable: "auth/unavailable",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text || null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

function parseAuthPopupMessage(data) {
  if (!isRecord(data)) {
    return null;
  }

  const source = normalizeText(data.source);
  const type = normalizeText(data.type);
  const event = normalizeText(data.event);

  if (source === AUTH_POPUP_MESSAGE_SOURCE && type === AUTH_POPUP_MESSAGE_TYPE) {
    if (event === "login_success") {
      return {
        accessToken: normalizeText(data.accessToken) || normalizeText(data.token),
        code: normalizeOptionalText(data.code),
        correlationId: normalizeOptionalText(data.correlationId),
        event: "login-success",
        message: normalizeOptionalText(data.message),
      };
    }

    if (event === "login_error") {
      return {
        accessToken: "",
        code: normalizeOptionalText(data.code),
        correlationId: normalizeOptionalText(data.correlationId),
        event: "login-error",
        message: normalizeOptionalText(data.message) || normalizeOptionalText(data.error),
      };
    }

    if (event === "oauth_linked") {
      return {
        accessToken: "",
        code: normalizeOptionalText(data.code),
        correlationId: normalizeOptionalText(data.correlationId),
        event: "oauth-linked",
        message: normalizeOptionalText(data.message),
      };
    }
  }

  if (type === "LOGIN_SUCCESS") {
    return {
      accessToken: normalizeText(data.accessToken) || normalizeText(data.token),
      code: null,
      correlationId: normalizeOptionalText(data.correlationId),
      event: "login-success",
      message: null,
    };
  }

  if (type === "LOGIN_ERROR") {
    return {
      accessToken: "",
      code: normalizeOptionalText(data.code),
      correlationId: normalizeOptionalText(data.correlationId),
      event: "login-error",
      message: normalizeOptionalText(data.message) || normalizeOptionalText(data.error),
    };
  }

  if (type === "OAUTH_LINKED") {
    return {
      accessToken: "",
      code: null,
      correlationId: normalizeOptionalText(data.correlationId),
      event: "oauth-linked",
      message: null,
    };
  }

  return null;
}

function buildTrustedLoginOrigins(authLoginPopupUrl, authTrustedLoginOrigins, safeOriginFromUrl) {
  const loginPopupOrigin = safeOriginFromUrl(authLoginPopupUrl);
  return Array.from(new Set([loginPopupOrigin, ...(authTrustedLoginOrigins || [])].filter(Boolean)));
}

function mapAuthErrorCode(statusCode) {
  if (statusCode === 400) {
    return AUTH_ERROR_CODE.accessTokenMissing;
  }
  if (statusCode === 401) {
    return AUTH_ERROR_CODE.invalidAccessToken;
  }
  if (statusCode === 403) {
    return AUTH_ERROR_CODE.authorizationDenied;
  }
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return AUTH_ERROR_CODE.unavailable;
  }
  return AUTH_ERROR_CODE.sessionSyncFailed;
}

function buildAuthErrorPayload({
  code,
  correlationId,
  message,
  retryable = false,
}) {
  return {
    authenticated: false,
    correlationId,
    error: {
      code,
      correlationId,
      message,
      retryable: Boolean(retryable),
    },
    message,
  };
}

module.exports = {
  AUTH_ERROR_CODE,
  AUTH_POPUP_MESSAGE_SOURCE,
  AUTH_POPUP_MESSAGE_TYPE,
  AUTH_POPUP_NAME,
  buildAuthErrorPayload,
  buildTrustedLoginOrigins,
  mapAuthErrorCode,
  parseAuthPopupMessage,
};
