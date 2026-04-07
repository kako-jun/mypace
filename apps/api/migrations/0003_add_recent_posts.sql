-- Recent posts table for duplicate content detection
-- Records are not periodically deleted; stale rows are excluded via WHERE created_at > cutoff
CREATE TABLE IF NOT EXISTS recent_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_posts_pubkey_hash ON recent_posts (pubkey, content_hash, created_at);
