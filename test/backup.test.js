const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const Database = require("better-sqlite3");
const { DATABASES, createBackup } = require("../scripts/backup-sqlite");
const { verifyBackup } = require("../scripts/verify-sqlite-backup");
const { deleteGuildData } = require("../scripts/delete-guild-data");

test("SQLite backup and restore verification cover both runtime databases", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-backup-"));
  const dataDir = path.join(root, "data");
  const outputDir = path.join(root, "backup");
  fs.mkdirSync(dataDir);
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));

  for (const database of DATABASES) {
    const connection = new Database(path.join(dataDir, database.fileName));
    try {
      for (const table of database.requiredTables) {
        connection.exec(`CREATE TABLE "${table}" (id INTEGER)`);
      }
    } finally {
      connection.close();
    }
  }

  const manifest = await createBackup({ dataDir, outputDir });
  assert.equal(manifest.files.length, 2);
  assert.deepEqual(verifyBackup(outputDir), {
    backupDir: outputDir,
    isolatedRestoreVerified: true,
    restoredDatabaseCount: 2,
  });
});

test("guild deletion removes every local guild-scoped record", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-delete-"));
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir);
  const databasePath = path.join(dataDir, "control-center.db");
  const database = new Database(databasePath);
  try {
    database.exec(`
      CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY);
      CREATE TABLE countdown_alert_state (guild_id TEXT PRIMARY KEY);
      CREATE TABLE suggestion_state (guild_id TEXT PRIMARY KEY);
      CREATE TABLE starboard_entries (guild_id TEXT);
      CREATE TABLE leveling_member_stats (guild_id TEXT, user_id TEXT);
      CREATE TABLE ticket_runtime_state (guild_id TEXT PRIMARY KEY);
      CREATE TABLE ticket_open_tickets (guild_id TEXT, user_id TEXT);
      CREATE TABLE modmail_message_map (guild_id TEXT);
      CREATE TABLE automation_cooldown_state (guild_id TEXT, cooldown_key TEXT);
      CREATE TABLE anti_raid_lockdown_state (guild_id TEXT PRIMARY KEY);
    `);
    for (const table of [
      "guild_settings",
      "countdown_alert_state",
      "suggestion_state",
      "starboard_entries",
      "leveling_member_stats",
      "ticket_runtime_state",
      "ticket_open_tickets",
      "modmail_message_map",
      "automation_cooldown_state",
      "anti_raid_lockdown_state",
    ]) {
      database.prepare(`INSERT INTO "${table}" (guild_id) VALUES (?)`).run("123456789012345678");
    }
  } finally {
    database.close();
  }

  try {
    const result = deleteGuildData({ dataDir, guildId: "123456789012345678" });
    assert.equal(Object.values(result.deletedRows).reduce((sum, count) => sum + count, 0), 10);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
