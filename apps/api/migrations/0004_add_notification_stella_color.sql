-- Migration: Add stella_color column to notifications table
-- Run this migration with: npx wrangler d1 execute mypace-db --file=./migrations/0004_add_notification_stella_color.sql

-- Add stella_color column with default 'yellow' for existing records
ALTER TABLE notifications ADD COLUMN stella_color TEXT DEFAULT 'yellow';
