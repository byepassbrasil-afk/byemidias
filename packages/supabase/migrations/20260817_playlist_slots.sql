-- Migration: Add playlist slots for reserved time segments
-- Run this on Supabase SQL Editor

-- 1. Create playlist_slots table
CREATE TABLE IF NOT EXISTS playlist_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
  slot_order INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, slot_order)
);

-- 2. Add slot_id to playlist_items
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES playlist_slots(id) ON DELETE SET NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_playlist_slots_playlist ON playlist_slots(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_slots_partner ON playlist_slots(partner_access_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_slot ON playlist_items(slot_id);

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON playlist_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlist_slots TO authenticated;
