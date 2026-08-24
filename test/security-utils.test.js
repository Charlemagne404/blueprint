const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeReturnTo, tokensMatch } = require("../src/security-utils");

test("return paths stay on the Blueprint origin", () => {
  assert.equal(normalizeReturnTo("/dashboard/123?tab=modules"), "/dashboard/123?tab=modules");
  assert.equal(normalizeReturnTo("https://example.com"), "/dashboard");
  assert.equal(normalizeReturnTo("//example.com"), "/dashboard");
  assert.equal(normalizeReturnTo("/\\\\example.com"), "/dashboard");
  assert.equal(normalizeReturnTo("/dashboard\u0000"), "/dashboard");
});

test("CSRF tokens use constant-time comparison semantics", () => {
  assert.equal(tokensMatch("same-token", "same-token"), true);
  assert.equal(tokensMatch("same-token", "different-token"), false);
  assert.equal(tokensMatch("same-token", ""), false);
});
