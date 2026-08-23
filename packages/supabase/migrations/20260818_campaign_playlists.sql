-- Migration: Multiple playlists per campaign + device targeting
-- Run AFTER existing schema

-- 1. Create junction table: campaign_playlists
CREATE TABLE IF NOT EXISTS campaign_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    duration INTEGER, -- seconds to play this playlist (0 = until items end)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, playlist_id)
);

-- 2. Migrate existing data: move campaign.playlist_id → campaign_playlists
INSERT INTO campaign_playlists (campaign_id, playlist_id, position)
SELECT id, playlist_id, 0
FROM campaigns
WHERE playlist_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaign_playlists_campaign ON campaign_playlists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_playlists_playlist ON campaign_playlists(playlist_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_device ON campaign_targets(target_id);

-- 4. Add RLS policies
ALTER TABLE campaign_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on campaign_playlists"
    ON campaign_playlists FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Org members view own campaign_playlists"
    ON campaign_playlists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_playlists.campaign_id
            AND c.organization_id = auth.user_organization_id()
        )
    );
