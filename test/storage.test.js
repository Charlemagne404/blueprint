const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("guild settings persist intentional zero values and new automation copy", (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-storage-"));
  t.after(() => fs.rmSync(dataDir, { force: true, recursive: true }));

  const storagePath = path.resolve(__dirname, "../src/storage.js");
  const script = `
    const { getGuildSettings, saveGuildSettings } = require(${JSON.stringify(storagePath)});
    const guildId = "999999999999999999";
    const settings = getGuildSettings(guildId);
    saveGuildSettings(guildId, {
      ...settings,
      autoModerationMentionLimit: 0,
      automationsCooldownSeconds: 0,
      automationsMessage: "Custom {source}",
      levelingCooldownSeconds: 0,
    }, "test-user");
    const saved = getGuildSettings(guildId);
    process.stdout.write(JSON.stringify({
      autoModerationMentionLimit: saved.autoModerationMentionLimit,
      automationsCooldownSeconds: saved.automationsCooldownSeconds,
      automationsMessage: saved.automationsMessage,
      levelingCooldownSeconds: saved.levelingCooldownSeconds,
    }));
  `;
  const output = childProcess.execFileSync(process.execPath, ["-e", script], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      NODE_ENV: "test",
    },
    encoding: "utf8",
  });

  assert.deepEqual(JSON.parse(output), {
    autoModerationMentionLimit: 0,
    automationsCooldownSeconds: 0,
    automationsMessage: "Custom {source}",
    levelingCooldownSeconds: 0,
  });
});
