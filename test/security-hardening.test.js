const test = require("node:test");
const assert = require("node:assert/strict");

const { readResponseText } = require("../src/http-client");
const { createMetrics, formatPrometheus } = require("../src/metrics");
const { createRateLimiter } = require("../src/rate-limit");

test("rate limiter rejects bursts and exposes a retry window", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    limit: 2,
    now: () => now,
    windowMs: 10_000,
  });
  const requests = {
    accepts: () => false,
    ip: "127.0.0.1",
  };
  const response = createResponseMock();
  let nextCalls = 0;

  limiter.middleware(requests, response, () => { nextCalls += 1; });
  limiter.middleware(requests, response, () => { nextCalls += 1; });
  limiter.middleware(requests, response, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "10");
  assert.equal(response.jsonBody.retryAfterSeconds, 10);

  now += 10_000;
  limiter.middleware(requests, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 3);
});

test("metrics stays bounded and renders token-free Prometheus output", () => {
  const metrics = createMetrics({ now: () => 1_700_000_000_000 });
  metrics.increment("auth_failures_total");
  metrics.observe("http_request", 25);

  const snapshot = metrics.snapshot();
  const output = formatPrometheus(snapshot);
  assert.equal(snapshot.counters.auth_failures_total, 1);
  assert.match(output, /blueprint_auth_failures_total 1/);
  assert.match(output, /blueprint_http_request_duration_ms_count 1/);
  assert.doesNotMatch(output, /guild|user|token/i);
});

test("external response bodies are capped before parsing", async () => {
  await assert.rejects(
    () => readResponseText(new Response("0123456789"), 4),
    (error) => error.code === "response_too_large",
  );
});

function createResponseMock() {
  return {
    headers: {},
    jsonBody: null,
    statusCode: 200,
    json(value) {
      this.jsonBody = value;
    },
    send(value) {
      this.body = value;
    },
    set(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
  };
}
