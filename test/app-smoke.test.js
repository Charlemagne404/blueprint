const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DISCORD_TOKEN = "blueprint-test-token";
process.env.DISCORD_CLIENT_ID = "123456789012345678";
process.env.DISCORD_SESSION_SECRET = "blueprint-test-session-secret-0123456789";
process.env.BASE_URL = "http://localhost:3000";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-app-"));

const { app, client } = require("../src/index");

test("Express health and readiness routes are available without a Discord login", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => {
    server.close();
    client.destroy();
  });

  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${origin}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const readiness = await fetch(`${origin}/readyz`);
  assert.equal(readiness.status, 503);
  assert.deepEqual(await readiness.json(), {
    botReady: false,
    ok: false,
    storageReady: true,
  });
});
