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
-- Stores one row per (event, reactor, color) allowing multiple colors per reaction
CREATE TABLE IF NOT EXISTS user_stella (
  event_id TEXT NOT NULL,           -- Post that received stella
  author_pubkey TEXT NOT NULL,      -- Author of the post (for aggregation)
  reactor_pubkey TEXT NOT NULL,     -- User who gave stella
  stella_count INTEGER NOT NULL,    -- Stella count (1-10)
  stella_color TEXT NOT NULL DEFAULT 'yellow', -- Stella color (yellow, green, red, blue, purple)
  reaction_id TEXT,                 -- Reaction event ID (for deletion)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reactor_pubkey, stella_color)
);

CREATE INDEX IF NOT EXISTS idx_user_stella_author ON user_stella(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reactor ON user_stella(reactor_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reaction ON user_stella(reaction_id);
CREATE INDEX IF NOT EXISTS idx_user_stella_event_reactor ON user_stella(event_id, reactor_pubkey);

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
  stella_color TEXT DEFAULT 'yellow', -- Stella color (yellow, green, red, blue, purple)
  created_at INTEGER NOT NULL,
  read_at INTEGER                     -- When user tapped to view (NULL = unread)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_pubkey);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type_target ON notifications(type, target_event_id, actor_pubkey);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source_event_id);

-- Push subscriptions table (for Web Push notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,               -- User's Nostr public key
  endpoint TEXT NOT NULL UNIQUE,      -- Push Service endpoint URL
  auth TEXT NOT NULL,                 -- Encryption auth key (base64)
  p256dh TEXT NOT NULL,               -- Encryption public key (base64)
  preference TEXT DEFAULT 'all',      -- 'all' | 'replies_only'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_pubkey ON push_subscriptions(pubkey);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_preference ON push_subscriptions(preference);

-- User stella balance table (for tracking stella inventory by color)
-- This is the "wallet" for sending colored stella to other users
CREATE TABLE IF NOT EXISTS user_stella_balance (
  pubkey TEXT PRIMARY KEY,
  yellow INTEGER NOT NULL DEFAULT 0,
  green INTEGER NOT NULL DEFAULT 0,
  red INTEGER NOT NULL DEFAULT 0,
  blue INTEGER NOT NULL DEFAULT 0,
  purple INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Supernova achievement definitions
-- Defines all available Supernovas and their rewards
-- Note: Yellow stella is infinite (no balance tracking), so no reward_yellow
CREATE TABLE IF NOT EXISTS supernova_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'single',  -- 'single' (one-time) or 'cumulative'
  threshold INTEGER DEFAULT 1,              -- Number required to unlock (1 for single, N for cumulative)
  supernova_color TEXT DEFAULT 'yellow',    -- Color of the supernova icon
  reward_green INTEGER NOT NULL DEFAULT 0,
  reward_red INTEGER NOT NULL DEFAULT 0,
  reward_blue INTEGER NOT NULL DEFAULT 0,
  reward_purple INTEGER NOT NULL DEFAULT 0
);

-- User supernova achievements (unlocked achievements)
CREATE TABLE IF NOT EXISTS user_supernovas (
  pubkey TEXT NOT NULL,
  supernova_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (pubkey, supernova_id)
);

CREATE INDEX IF NOT EXISTS idx_user_supernovas_pubkey ON user_supernovas(pubkey);
CREATE INDEX IF NOT EXISTS idx_user_supernovas_supernova ON user_supernovas(supernova_id);

-- Magazine views table
CREATE TABLE IF NOT EXISTS magazine_views (
  magazine_key TEXT PRIMARY KEY,        -- "pubkey:slug" composite key
  pubkey TEXT NOT NULL,                 -- Magazine owner pubkey
  slug TEXT NOT NULL,                   -- Magazine slug
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magazine_views_pubkey ON magazine_views(pubkey);

-- Magazine view users table (unique viewers)
CREATE TABLE IF NOT EXISTS magazine_view_users (
  magazine_key TEXT NOT NULL,
  viewer_pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (magazine_key, viewer_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_magazine_view_users_magazine ON magazine_view_users(magazine_key);

-- Magazine OGP cache table
CREATE TABLE IF NOT EXISTS magazine_ogp_cache (
  cache_key TEXT PRIMARY KEY,           -- "magazine:pubkey:slug"
  title TEXT,
  description TEXT,
  image TEXT,
  author TEXT,
  post_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magazine_ogp_cache_expires ON magazine_ogp_cache(expires_at);

-- Initial Supernova definitions (seed data)
-- These will be inserted via API POST /api/supernovas/seed
-- See apps/api/src/routes/supernovas.ts for full definitions

-- =====================================================
-- Wordrot (ワードロット) tables
-- =====================================================

-- Words master table (global word dictionary)
CREATE TABLE IF NOT EXISTS wordrot_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL UNIQUE,              -- Word text (e.g., "マリオ", "ファイア")
  image_url TEXT,                         -- harvest: nostr.build image URL (yellow bg)
  image_hash TEXT,                        -- harvest: SHA-256 hash for NIP-96 deletion
  image_status TEXT DEFAULT 'pending',    -- harvest: 'pending' | 'generating' | 'done' | 'failed'
  image_url_synthesis TEXT,               -- synthesis: nostr.build image URL (green bg)
  image_hash_synthesis TEXT,              -- synthesis: SHA-256 hash for NIP-96 deletion
  image_status_synthesis TEXT DEFAULT 'pending', -- synthesis: 'pending' | 'generating' | 'done' | 'failed'
  discovered_by TEXT,                     -- Pubkey of first discoverer
  discovered_at INTEGER NOT NULL,
  discovery_count INTEGER DEFAULT 1,      -- Total times discovered by users
  synthesis_count INTEGER DEFAULT 0,      -- Times created via synthesis
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wordrot_words_text ON wordrot_words(text);
CREATE INDEX IF NOT EXISTS idx_wordrot_words_discovered_by ON wordrot_words(discovered_by);
CREATE INDEX IF NOT EXISTS idx_wordrot_words_discovery_count ON wordrot_words(discovery_count DESC);

-- User word collection (user's inventory) — boolean ownership (row exists = owned)
CREATE TABLE IF NOT EXISTS wordrot_user_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  first_collected_at INTEGER NOT NULL,
  last_collected_at INTEGER NOT NULL,
  source TEXT DEFAULT 'harvest',          -- 'harvest' | 'synthesis'
  FOREIGN KEY (word_id) REFERENCES wordrot_words(id),
  UNIQUE(pubkey, word_id, source)
);

CREATE INDEX IF NOT EXISTS idx_wordrot_user_words_pubkey ON wordrot_user_words(pubkey);
CREATE INDEX IF NOT EXISTS idx_wordrot_user_words_word ON wordrot_user_words(word_id);

-- Synthesis history (A - B + C = Result)
CREATE TABLE IF NOT EXISTS wordrot_syntheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_a_id INTEGER NOT NULL,             -- Base word
  word_b_id INTEGER NOT NULL,             -- Word to subtract
  word_c_id INTEGER NOT NULL,             -- Word to add
  result_word_id INTEGER NOT NULL,        -- Result word
  discovered_by TEXT,                     -- Pubkey of first discoverer of this combination
  discovered_at INTEGER NOT NULL,
  use_count INTEGER DEFAULT 1,            -- Times this combo was used
  FOREIGN KEY (word_a_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (word_b_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (word_c_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (result_word_id) REFERENCES wordrot_words(id),
  UNIQUE(word_a_id, word_b_id, word_c_id)
);

CREATE INDEX IF NOT EXISTS idx_wordrot_syntheses_result ON wordrot_syntheses(result_word_id);

-- Event word cache (cached noun extraction results)
CREATE TABLE IF NOT EXISTS wordrot_event_words (
  event_id TEXT PRIMARY KEY,              -- Nostr event ID
  words_json TEXT NOT NULL,               -- JSON array: ["マリオ", "冒険", ...]
  analyzed_at INTEGER NOT NULL
);

-- Image generation queue (for async processing)
CREATE TABLE IF NOT EXISTS wordrot_image_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',          -- 'pending' | 'processing' | 'done' | 'failed'
  attempts INTEGER DEFAULT 0,
  last_attempt_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (word_id) REFERENCES wordrot_words(id)
);

CREATE INDEX IF NOT EXISTS idx_wordrot_image_queue_status ON wordrot_image_queue(status);

