PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL REFERENCES teams(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operations (
  key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id)
);
