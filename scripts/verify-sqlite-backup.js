"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const Database = require("better-sqlite3");
const { DATABASES, verifyDatabase } = require("./backup-sqlite");

function verifyBackup(backupDir) {
  const resolvedBackupDir = path.resolve(backupDir);
  const manifestPath = path.join(resolvedBackupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Backup manifest.json is missing.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const restoredDir = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-restore-"));

  try {
    for (const database of DATABASES) {
      const sourcePath = path.join(resolvedBackupDir, database.fileName);
      const restoredPath = path.join(restoredDir, database.fileName);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Backup is missing ${database.fileName}.`);
      }

      const expected = manifest.files?.find((file) => file.fileName === database.fileName);
      if (!expected || expected.sha256 !== hashFile(sourcePath)) {
        throw new Error(`Checksum mismatch for ${database.fileName}.`);
      }

      fs.copyFileSync(sourcePath, restoredPath);
      verifyDatabase(restoredPath, database.requiredTables);
      verifyRestoredData(restoredPath, database.fileName);
    }

    return {
      backupDir: resolvedBackupDir,
      isolatedRestoreVerified: true,
      restoredDatabaseCount: DATABASES.length,
    };
  } finally {
    fs.rmSync(restoredDir, { force: true, recursive: true });
  }
}

function verifyRestoredData(databasePath, fileName) {
  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    const tableNames = fileName === "sessions.db"
      ? ["sessions"]
      : DATABASES[0].requiredTables;
    for (const tableName of tableNames) {
      database.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get();
    }
  } finally {
    database.close();
  }
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseBackupDir(argv) {
  if (argv.length !== 2 || argv[0] !== "--backup-dir" || !argv[1]) {
    throw new Error("Usage: node scripts/verify-sqlite-backup.js --backup-dir <directory>");
  }
  return argv[1];
}

if (require.main === module) {
  try {
    const result = verifyBackup(parseBackupDir(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`SQLite backup verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  verifyBackup,
};
