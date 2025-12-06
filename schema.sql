-- Events cache
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  sig TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- User profiles cache (kind:0)
CREATE TABLE IF NOT EXISTS profiles (
  pubkey TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  picture TEXT,
  about TEXT,
  nip05 TEXT,
  raw_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);
