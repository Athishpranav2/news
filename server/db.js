const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'timeline.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS timelines (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timeline_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    pos_x REAL DEFAULT 0,
    pos_y REAL DEFAULT 0,
    position_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    event_source TEXT NOT NULL,
    event_target TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'cause',
    timeline_id TEXT NOT NULL,
    FOREIGN KEY (event_source) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (event_target) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
  );
`);

// Migration: add user_id column if missing (for existing DBs)
try {
  db.exec(`ALTER TABLE timelines ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
} catch (e) {
  // Column already exists, ignore
}

module.exports = db;
