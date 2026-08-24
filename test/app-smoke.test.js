const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "blueprint-test-token";
process.env.DISCORD_CLIENT_ID = "123456789012345678";
process.env.DISCORD_SESSION_SECRET = "blueprint-test-session-secret-0123456789";
process.env.BASE_URL = "http://localhost:3000";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-app-"));

const { app, client, start } = require("../src/index");

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
    sessionReady: true,
    storageReady: true,
  });

  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  const csrfToken = homeHtml.match(/"csrfToken":"([^"]+)"/)?.[1];
  const cookie = home.headers.get("set-cookie")?.split(";", 1)[0];
  assert.match(csrfToken || "", /^[a-f0-9]{64}$/);
  assert.match(cookie || "", /^blueprint\.sid=/);

  const rejectedLogout = await fetch(`${origin}/logout`, {
    headers: { Cookie: cookie },
    method: "POST",
  });
  assert.equal(rejectedLogout.status, 403);

  const logout = await fetch(`${origin}/logout`, {
    headers: {
      Cookie: cookie,
      "X-CSRF-Token": csrfToken,
    },
    method: "POST",
    redirect: "manual",
  });
  assert.equal(logout.status, 302);
  assert.match(logout.headers.get("set-cookie") || "", /Expires=Thu, 01 Jan 1970/);

  const degradedServer = await start({
    login: () => Promise.reject(new Error("gateway unavailable")),
    port: 0,
  });
  await new Promise((resolve) => degradedServer.once("listening", resolve));
  t.after(() => degradedServer.close());

  const degradedAddress = degradedServer.address();
  const degradedHealth = await fetch(`http://127.0.0.1:${degradedAddress.port}/healthz`);
  assert.equal(degradedHealth.status, 200);
});
