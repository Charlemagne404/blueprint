"use strict";

const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

const GUILD_TABLES = [
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
];

function deleteGuildData({ dataDir, guildId }) {
  const normalizedGuildId = normalizeGuildId(guildId);
  if (!normalizedGuildId) {
    throw new Error("guildId must be a Discord snowflake.");
  }

  const databasePath = path.join(path.resolve(dataDir), "control-center.db");
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Control-center database does not exist: ${databasePath}`);
  }

  const database = new Database(databasePath);
  database.pragma("busy_timeout = 10000");
  try {
    const existingTables = new Set(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );
    const deleteRows = database.transaction(() => {
      const counts = {};
      for (const table of GUILD_TABLES) {
        if (!existingTables.has(table)) {
          counts[table] = 0;
          continue;
        }

        const result = database
          .prepare(`DELETE FROM "${table}" WHERE guild_id = ?`)
          .run(normalizedGuildId);
        counts[table] = result.changes;
      }
      return counts;
    });

    return {
      databasePath,
      guildId: normalizedGuildId,
      deletedRows: deleteRows(),
    };
  } finally {
    database.close();
  }
}

function normalizeGuildId(value) {
  const normalized = String(value || "").trim();
  return /^\d{16,20}$/.test(normalized) ? normalized : "";
}

function parseArguments(argv) {
  const options = {
    confirmGuildId: "",
    dataDir: path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")),
    guildId: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--data-dir", "--guild-id", "--confirm-guild-id"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--data-dir") {
        options.dataDir = path.resolve(value);
      } else if (argument === "--guild-id") {
        options.guildId = value;
      } else {
        options.confirmGuildId = value;
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.guildId || options.confirmGuildId !== options.guildId) {
    throw new Error(
      "Deletion requires --guild-id <id> and the same --confirm-guild-id <id>.",
    );
  }

  return options;
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(deleteGuildData(options))}\n`);
  } catch (error) {
    process.stderr.write(`Guild data deletion failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  GUILD_TABLES,
  deleteGuildData,
  normalizeGuildId,
  parseArguments,
};
