const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTH_ERROR_CODE,
  AUTH_POPUP_MESSAGE_SOURCE,
  AUTH_POPUP_MESSAGE_TYPE,
  buildAuthErrorPayload,
  buildTrustedLoginOrigins,
  mapAuthErrorCode,
  parseAuthPopupMessage,
} = require("../src/auth-contract");

test("buildTrustedLoginOrigins deduplicates the popup origin and configured extras", () => {
  const origins = buildTrustedLoginOrigins(
    "https://login.continental-hub.com/popup.html",
    ["https://login.continental-hub.com", "https://preview.continental-hub.com"],
    (value) => new URL(value).origin,
  );

  assert.deepEqual(origins, [
    "https://login.continental-hub.com",
    "https://preview.continental-hub.com",
  ]);
});

test("parseAuthPopupMessage accepts canonical login success payloads", () => {
  const message = parseAuthPopupMessage({
    accessToken: "token-1",
    correlationId: "corr-1",
    event: "login_success",
    source: AUTH_POPUP_MESSAGE_SOURCE,
    type: AUTH_POPUP_MESSAGE_TYPE,
  });

  assert.deepEqual(message, {
    accessToken: "token-1",
    code: null,
    correlationId: "corr-1",
    event: "login-success",
    message: null,
  });
});

test("mapAuthErrorCode normalizes common auth failures", () => {
  assert.equal(mapAuthErrorCode(400), AUTH_ERROR_CODE.accessTokenMissing);
  assert.equal(mapAuthErrorCode(401), AUTH_ERROR_CODE.invalidAccessToken);
  assert.equal(mapAuthErrorCode(403), AUTH_ERROR_CODE.authorizationDenied);
  assert.equal(mapAuthErrorCode(503), AUTH_ERROR_CODE.unavailable);
  assert.equal(mapAuthErrorCode(500), AUTH_ERROR_CODE.sessionSyncFailed);
});

test("buildAuthErrorPayload returns a machine-readable auth envelope", () => {
  const payload = buildAuthErrorPayload({
    code: AUTH_ERROR_CODE.sessionSyncFailed,
    correlationId: "corr-9",
    message: "Session sync failed.",
    retryable: true,
  });

  assert.deepEqual(payload, {
    authenticated: false,
    correlationId: "corr-9",
    error: {
      code: AUTH_ERROR_CODE.sessionSyncFailed,
      correlationId: "corr-9",
      message: "Session sync failed.",
      retryable: true,
    },
    message: "Session sync failed.",
  });
});
