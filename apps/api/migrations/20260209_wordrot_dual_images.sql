-- Migration: Add synthesis-specific image fields to wordrot_words
-- Date: 2026-02-09
-- Purpose: Support separate images for harvest (yellow bg) and synthesis (green bg)

-- Add synthesis image fields to wordrot_words
ALTER TABLE wordrot_words ADD COLUMN image_url_synthesis TEXT;
ALTER TABLE wordrot_words ADD COLUMN image_hash_synthesis TEXT;
ALTER TABLE wordrot_words ADD COLUMN image_status_synthesis TEXT DEFAULT 'pending';

-- Update UNIQUE constraint on wordrot_user_words to include source
-- Note: SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE wordrot_user_words_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  count INTEGER DEFAULT 1,
  first_collected_at INTEGER NOT NULL,
  last_collected_at INTEGER NOT NULL,
  source TEXT DEFAULT 'harvest',
  FOREIGN KEY (word_id) REFERENCES wordrot_words(id),
  UNIQUE(pubkey, word_id, source)
);

-- Step 2: Copy existing data
INSERT INTO wordrot_user_words_new 
  (id, pubkey, word_id, count, first_collected_at, last_collected_at, source)
SELECT id, pubkey, word_id, count, first_collected_at, last_collected_at, source
FROM wordrot_user_words;

-- Step 3: Drop old table
DROP TABLE wordrot_user_words;

-- Step 4: Rename new table
ALTER TABLE wordrot_user_words_new RENAME TO wordrot_user_words;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_wordrot_user_words_pubkey ON wordrot_user_words(pubkey);
CREATE INDEX IF NOT EXISTS idx_wordrot_user_words_word ON wordrot_user_words(word_id);
