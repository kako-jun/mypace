-- Events cache table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags TEXT NOT NULL,
  content TEXT NOT NULL,
  sig TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Profiles cache table
CREATE TABLE IF NOT EXISTS profiles (
  pubkey TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  picture TEXT,
  about TEXT,
  nip05 TEXT,
  banner TEXT,
  website TEXT,
  websites TEXT,
  lud16 TEXT,
  emojis TEXT,
  cached_at INTEGER NOT NULL
);

-- Migration: Add new profile columns (run manually if table exists)
-- ALTER TABLE profiles ADD COLUMN banner TEXT;
-- ALTER TABLE profiles ADD COLUMN website TEXT;
-- ALTER TABLE profiles ADD COLUMN websites TEXT;
-- ALTER TABLE profiles ADD COLUMN lud16 TEXT;
-- ALTER TABLE profiles ADD COLUMN emojis TEXT;
