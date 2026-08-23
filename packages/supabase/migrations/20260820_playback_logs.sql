-- =====================================================
-- PHASE 4: Reports - Playback logs + Aggregation
-- =====================================================

-- Playback log - each time a media item is played on a device
CREATE TABLE IF NOT EXISTS playback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    campaign_id UUID REFERENCES campaigns(id),
    playlist_id UUID REFERENCES playlists(id),
    media_id UUID REFERENCES media(id),
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playback_device ON playback_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_playback_campaign ON playback_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_playback_media ON playback_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_playback_date ON playback_logs(played_at);
CREATE INDEX IF NOT EXISTS idx_playback_org ON playback_logs(organization_id);

ALTER TABLE playback_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_playback" ON playback_logs FOR ALL
    USING (auth.role() = 'service_role');
CREATE POLICY "org_read_playback" ON playback_logs FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Function: generate daily playback summary
CREATE OR REPLACE FUNCTION get_playback_summary(
    p_org_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS TABLE (
    date TEXT,
    device_name TEXT,
    campaign_name TEXT,
    media_name TEXT,
    play_count BIGINT,
    total_duration_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(pl.played_at, 'YYYY-MM-DD') AS date,
        d.name AS device_name,
        c.name AS campaign_name,
        m.name AS media_name,
        COUNT(*) AS play_count,
        ROUND(SUM(COALESCE(pl.duration_seconds, 0)) / 3600.0, 2) AS total_duration_hours
    FROM playback_logs pl
    LEFT JOIN devices d ON d.id = pl.device_id
    LEFT JOIN campaigns c ON c.id = pl.campaign_id
    LEFT JOIN media m ON m.id = pl.media_id
    WHERE pl.organization_id = p_org_id
    AND pl.played_at >= p_start
    AND pl.played_at <= p_end
    GROUP BY TO_CHAR(pl.played_at, 'YYYY-MM-DD'), d.name, c.name, m.name
    ORDER BY date DESC, play_count DESC;
END;
$$ LANGUAGE plpgsql;
