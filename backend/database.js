const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'vocabulerly.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    meaning TEXT NOT NULL,
    part_of_speech TEXT,
    example TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('daily', 'workplace', 'general')),
    difficulty_level INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'not_learned' CHECK(status IN ('learned', 'not_learned', 'skipped', 'difficult')),
    times_reviewed INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    last_reviewed_at TEXT,
    next_review_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (word_id) REFERENCES words(id)
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    words_learned INTEGER DEFAULT 0,
    words_reviewed INTEGER DEFAULT 0,
    quiz_score INTEGER DEFAULT 0,
    quiz_total INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date TEXT,
    daily_goal INTEGER DEFAULT 10
  );

  CREATE INDEX IF NOT EXISTS idx_words_category ON words(category);
  CREATE INDEX IF NOT EXISTS idx_progress_status ON user_progress(status);
  CREATE INDEX IF NOT EXISTS idx_progress_next_review ON user_progress(next_review_at);

  CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    language TEXT NOT NULL DEFAULT 'ta',
    translated_meaning TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(word_id, language),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_translations_word_lang ON translations(word_id, language);

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
`);

// Initialize streaks if not exists
const streakRow = db.prepare('SELECT COUNT(*) as count FROM streaks').get();
if (streakRow.count === 0) {
  db.prepare('INSERT INTO streaks (current_streak, longest_streak, daily_goal) VALUES (0, 0, 10)').run();
}

module.exports = db;
