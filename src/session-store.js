const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");
const session = require("express-session");

class SqliteSessionStore extends session.Store {
  constructor({ dataDir, tableName = "sessions", ttlMs }) {
    super();

    this.ttlMs = ttlMs;
    this.tableName = tableName;
    fs.mkdirSync(dataDir, { recursive: true });

    this.db = new Database(path.join(dataDir, "sessions.db"));
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${this.tableName}_expired_at_idx
        ON ${this.tableName} (expired_at);
    `);

    this.getStatement = this.db.prepare(
      `SELECT sess, expired_at FROM ${this.tableName} WHERE sid = ?`,
    );
    this.setStatement = this.db.prepare(`
      INSERT INTO ${this.tableName} (sid, sess, expired_at)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET
        sess = excluded.sess,
        expired_at = excluded.expired_at
    `);
    this.destroyStatement = this.db.prepare(`DELETE FROM ${this.tableName} WHERE sid = ?`);
    this.pruneStatement = this.db.prepare(`DELETE FROM ${this.tableName} WHERE expired_at <= ?`);
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expired_at <= Date.now()) {
        this.destroyStatement.run(sid);
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionValue, callback = () => {}) {
    try {
      this.pruneExpiredSessions();
      this.setStatement.run(
        sid,
        JSON.stringify(sessionValue),
        getSessionExpiry(sessionValue, this.ttlMs),
      );
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionValue, callback = () => {}) {
    this.set(sid, sessionValue, callback);
  }

  destroy(sid, callback = () => {}) {
    try {
      this.destroyStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  pruneExpiredSessions() {
    this.pruneStatement.run(Date.now());
  }

  checkHealth() {
    this.db.prepare("SELECT 1").get();
    return true;
  }

  close() {
    this.db.close();
  }
}

function createSessionStore(options) {
  return new SqliteSessionStore(options);
}

function getSessionExpiry(sessionValue, ttlMs) {
  const expires = sessionValue?.cookie?.expires;
  if (expires) {
    const expiresAt = new Date(expires).getTime();
    if (Number.isFinite(expiresAt)) {
      return expiresAt;
    }
  }

  return Date.now() + ttlMs;
}

module.exports = {
  SqliteSessionStore,
  createSessionStore,
};
