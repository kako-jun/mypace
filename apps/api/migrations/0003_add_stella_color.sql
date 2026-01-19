-- Migration: Add stella_color column to user_stella table
-- Run this migration with: npx wrangler d1 execute mypace-db --file=./migrations/0003_add_stella_color.sql

-- Add stella_color column with default 'yellow' for existing records
ALTER TABLE user_stella ADD COLUMN stella_color TEXT DEFAULT 'yellow';
