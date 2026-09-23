ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'));
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL;
