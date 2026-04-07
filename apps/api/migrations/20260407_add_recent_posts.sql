-- Recent posts table for rate limiting and duplicate content detection
-- Stale rows (>1 hour) are cleaned up on each INSERT via recordRecentPost()
CREATE TABLE IF NOT EXISTS recent_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_posts_pubkey_hash ON recent_posts (pubkey, content_hash, created_at);
