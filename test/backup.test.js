const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const Database = require("better-sqlite3");
const { DATABASES, createBackup } = require("../scripts/backup-sqlite");
const { verifyBackup } = require("../scripts/verify-sqlite-backup");

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
