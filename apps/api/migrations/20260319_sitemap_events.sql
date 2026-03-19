-- Sitemap events table (for dynamic sitemap.xml generation)
-- Records mypace-tagged posts for Google indexing
CREATE TABLE IF NOT EXISTS sitemap_events (
  event_id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sitemap_events_created ON sitemap_events(created_at DESC);
