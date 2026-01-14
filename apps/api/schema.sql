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
CREATE INDEX IF NOT EXISTS idx_events_cached_at ON events(cached_at);

-- Migration: Add has_mypace_tag column for filtering (run manually if table exists)
-- ALTER TABLE events ADD COLUMN has_mypace_tag INTEGER DEFAULT 0;
-- CREATE INDEX IF NOT EXISTS idx_events_has_mypace_tag ON events(has_mypace_tag);
-- UPDATE events SET has_mypace_tag = 1 WHERE tags LIKE '%"t","mypace"%';

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

-- Super mention paths table (for Wikidata mapping)
CREATE TABLE IF NOT EXISTS super_mention_paths (
  path TEXT PRIMARY KEY,              -- "/manga/ハンチョウ"
  category TEXT NOT NULL,             -- "manga"
  wikidata_id TEXT,                   -- "Q123456789" (nullable)
  wikidata_label TEXT,                -- "1日外出録ハンチョウ"
  wikidata_description TEXT,          -- "日本の漫画作品"
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_super_mention_category ON super_mention_paths(category);
CREATE INDEX IF NOT EXISTS idx_super_mention_wikidata ON super_mention_paths(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_super_mention_use_count ON super_mention_paths(use_count DESC);

-- Sticker history table
CREATE TABLE IF NOT EXISTS sticker_history (
  url TEXT PRIMARY KEY,
  first_used_by TEXT,                 -- npub of the first user who used this sticker
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sticker_updated_at ON sticker_history(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sticker_first_used_by ON sticker_history(first_used_by);

-- Migration: Add first_used_by column (run manually if table exists)
-- ALTER TABLE sticker_history ADD COLUMN first_used_by TEXT;

-- User pinned posts table
CREATE TABLE IF NOT EXISTS user_pins (
  pubkey TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_pins_event ON user_pins(event_id);

-- User serial numbers table (participation order)
CREATE TABLE IF NOT EXISTS user_serial (
  pubkey TEXT PRIMARY KEY,
  serial_number INTEGER UNIQUE NOT NULL,
  first_post_id TEXT NOT NULL,
  first_post_at INTEGER NOT NULL,
  visible INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_serial_number ON user_serial(serial_number);
CREATE INDEX IF NOT EXISTS idx_user_serial_first_post_at ON user_serial(first_post_at);
CREATE INDEX IF NOT EXISTS idx_user_serial_visible ON user_serial(visible);

-- Upload history table (for nostr.build file tracking)
CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'image', 'video', 'audio'
  uploaded_at INTEGER NOT NULL,
  UNIQUE(pubkey, url)
);

CREATE INDEX IF NOT EXISTS idx_upload_history_pubkey ON upload_history(pubkey);
CREATE INDEX IF NOT EXISTS idx_upload_history_uploaded_at ON upload_history(uploaded_at DESC);

-- Event views table (for view count tracking)
CREATE TABLE IF NOT EXISTS event_views (
  event_id TEXT NOT NULL,
  viewer_pubkey TEXT NOT NULL,
  view_type TEXT NOT NULL,        -- 'impression' or 'detail'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, viewer_pubkey, view_type)
);

CREATE INDEX IF NOT EXISTS idx_event_views_event ON event_views(event_id);
CREATE INDEX IF NOT EXISTS idx_event_views_viewer ON event_views(viewer_pubkey);
CREATE INDEX IF NOT EXISTS idx_event_views_type ON event_views(view_type);

-- User stella table (for cumulative stella count per user)
CREATE TABLE IF NOT EXISTS user_stella (
  event_id TEXT NOT NULL,           -- Post that received stella
  author_pubkey TEXT NOT NULL,      -- Author of the post (for aggregation)
  reactor_pubkey TEXT NOT NULL,     -- User who gave stella
  stella_count INTEGER NOT NULL,    -- Stella count (1-10)
  reaction_id TEXT,                 -- Reaction event ID (for deletion)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reactor_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_user_stella_author ON user_stella(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reaction ON user_stella(reaction_id);
