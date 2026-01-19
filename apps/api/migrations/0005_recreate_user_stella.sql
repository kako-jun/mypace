-- Migration: Recreate user_stella table with stella_color in PRIMARY KEY
-- This allows storing multiple colors per user per event
-- Run: npx wrangler d1 execute mypace-db --remote --file=./migrations/0005_recreate_user_stella.sql

-- Create new table with correct PRIMARY KEY
CREATE TABLE IF NOT EXISTS user_stella_new (
  event_id TEXT NOT NULL,
  author_pubkey TEXT NOT NULL,
  reactor_pubkey TEXT NOT NULL,
  stella_count INTEGER NOT NULL,
  stella_color TEXT NOT NULL DEFAULT 'yellow',
  reaction_id TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reactor_pubkey, stella_color)
);

-- Copy existing data (each row becomes one color entry)
INSERT OR IGNORE INTO user_stella_new (event_id, author_pubkey, reactor_pubkey, stella_count, stella_color, reaction_id, updated_at)
SELECT event_id, author_pubkey, reactor_pubkey, stella_count, COALESCE(stella_color, 'yellow'), reaction_id, updated_at
FROM user_stella;

-- Drop old table
DROP TABLE user_stella;

-- Rename new table
ALTER TABLE user_stella_new RENAME TO user_stella;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_user_stella_author ON user_stella(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reaction ON user_stella(reaction_id);
CREATE INDEX IF NOT EXISTS idx_user_stella_event_reactor ON user_stella(event_id, reactor_pubkey);
