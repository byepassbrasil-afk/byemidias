-- Add expires_at column for file TTL (auto-deletion)
ALTER TABLE media ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_media_expires_at ON media(expires_at);
