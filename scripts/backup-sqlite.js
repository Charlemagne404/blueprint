"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");
require("dotenv").config();

const DATABASES = [
  {
    fileName: "control-center.db",
    requiredTables: [
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
    ],
  },
  {
    fileName: "sessions.db",
    requiredTables: ["sessions"],
  },
];

async function createBackup({ dataDir, outputDir }) {
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedOutputDir = path.resolve(outputDir);

  assertSafeOutputDirectory(resolvedDataDir, resolvedOutputDir);
  createEmptyDirectory(resolvedOutputDir);

  const backedUpFiles = [];
  try {
    for (const database of DATABASES) {
      const sourcePath = path.join(resolvedDataDir, database.fileName);
      const destinationPath = path.join(resolvedOutputDir, database.fileName);
      await backupDatabase(sourcePath, destinationPath, database.requiredTables);
      backedUpFiles.push({
        bytes: fs.statSync(destinationPath).size,
        fileName: database.fileName,
        sha256: hashFile(destinationPath),
      });
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      formatVersion: 1,
      files: backedUpFiles,
    };
    writePrivateJson(path.join(resolvedOutputDir, "manifest.json"), manifest);
    return manifest;
  } catch (error) {
    throw new Error(`Backup was not completed: ${error.message}`, { cause: error });
  }
}

async function backupDatabase(sourcePath, destinationPath, requiredTables) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source database: ${sourcePath}`);
  }

  const temporaryPath = `${destinationPath}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  const source = new Database(sourcePath, {
    fileMustExist: true,
    readonly: true,
  });

  try {
    source.pragma("busy_timeout = 10000");
    await source.backup(temporaryPath);
  } finally {
    source.close();
  }

  try {
    verifyDatabase(temporaryPath, requiredTables);
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, destinationPath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
    throw error;
  }
}

function verifyDatabase(databasePath, requiredTables) {
  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    const integrity = database.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(`SQLite integrity check failed for ${path.basename(databasePath)}.`);
    }

    const tables = new Set(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );
    for (const table of requiredTables) {
      if (!tables.has(table)) {
        throw new Error(`Backup is missing required table ${table}.`);
      }
    }
  } finally {
    database.close();
  }
}

function assertSafeOutputDirectory(dataDir, outputDir) {
  if (dataDir === outputDir) {
    throw new Error("Backup output directory must not be the live data directory.");
  }

  const relativeOutput = path.relative(dataDir, outputDir);
  if (relativeOutput && !relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput)) {
    throw new Error("Backup output directory must not be inside the live data directory.");
  }
}

function createEmptyDirectory(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    if (!fs.statSync(directoryPath).isDirectory()) {
      throw new Error(`Backup output is not a directory: ${directoryPath}`);
    }
    if (fs.readdirSync(directoryPath).length > 0) {
      throw new Error(`Backup output directory must be empty: ${directoryPath}`);
    }
  } else {
    fs.mkdirSync(directoryPath, { mode: 0o700, recursive: true });
  }

  fs.chmodSync(directoryPath, 0o700);
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writePrivateJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(filePath, 0o600);
}

function parseArguments(argv) {
  const options = {
    dataDir: path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")),
    outputDir: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--data-dir" || argument === "--output-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a path.`);
      }
      options[argument === "--data-dir" ? "dataDir" : "outputDir"] = path.resolve(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.outputDir) {
    const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
    options.outputDir = path.join(backupRoot, formatTimestamp(new Date()));
  }

  return options;
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = await createBackup(options);
  process.stdout.write(`${JSON.stringify({ backupDir: options.outputDir, ...manifest })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`SQLite backup failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DATABASES,
  createBackup,
  verifyDatabase,
};
