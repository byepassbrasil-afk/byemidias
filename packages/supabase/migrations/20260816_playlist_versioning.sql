-- Migration: Add playlist versioning + approval workflow
-- Run this on Supabase SQL Editor

-- 1. Add versioning columns to playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES playlists(id) ON DELETE SET NULL;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Create index for fast pending playlist queries
CREATE INDEX IF NOT EXISTS idx_playlists_approval_status ON playlists(approval_status);
CREATE INDEX IF NOT EXISTS idx_playlists_parent_id ON playlists(parent_id);

-- 3. Create index for partner_media_uploads lookup
CREATE INDEX IF NOT EXISTS idx_partner_media_uploads_partner ON partner_media_uploads(partner_access_id);

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON playlists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlists TO authenticated;
