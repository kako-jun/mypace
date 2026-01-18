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
  author_pubkey TEXT NOT NULL,    -- Author of the post (for user cumulative)
  viewer_pubkey TEXT NOT NULL,
  view_type TEXT NOT NULL,        -- 'impression' or 'detail'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, viewer_pubkey, view_type)
);

CREATE INDEX IF NOT EXISTS idx_event_views_event ON event_views(event_id);
CREATE INDEX IF NOT EXISTS idx_event_views_author ON event_views(author_pubkey);
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

-- OGP cache table
CREATE TABLE IF NOT EXISTS ogp_cache (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  image TEXT,
  site_name TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ogp_cache_expires ON ogp_cache(expires_at);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_pubkey TEXT NOT NULL,     -- User who receives the notification
  actor_pubkey TEXT NOT NULL,         -- User who performed the action
  type TEXT NOT NULL,                 -- 'stella' | 'reply' | 'repost'
  target_event_id TEXT NOT NULL,      -- Target post ID
  source_event_id TEXT,               -- Reply/repost event ID (NULL for stella)
  stella_count INTEGER,               -- Stella count (1-10), NULL for non-stella
  created_at INTEGER NOT NULL,
  read_at INTEGER                     -- When user tapped to view (NULL = unread)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_pubkey);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type_target ON notifications(type, target_event_id, actor_pubkey);
