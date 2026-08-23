-- =====================================================
-- PHASE 5: Schedule / Agendamento for Content Sync
-- =====================================================

CREATE TABLE IF NOT EXISTS content_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    campaign_id UUID REFERENCES campaigns(id),
    playlist_id UUID REFERENCES playlists(id),
    sync_type TEXT NOT NULL DEFAULT 'periodic' CHECK (sync_type IN ('periodic', 'specific', 'always')),
    sync_interval_minutes INTEGER DEFAULT 15,
    sync_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
    sync_start_time TIME DEFAULT '00:00',
    sync_end_time TIME DEFAULT '23:59',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device groups for bulk management
CREATE TABLE IF NOT EXISTS device_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(group_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_org ON content_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_active ON content_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_group_org ON device_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_group_member ON device_group_members(group_id, device_id);

ALTER TABLE content_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_schedules" ON content_schedules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "org_read_schedules" ON content_schedules FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "service_role_all_groups" ON device_groups FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "org_read_groups" ON device_groups FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "service_role_all_group_members" ON device_group_members FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "org_read_group_members" ON device_group_members FOR SELECT USING (
    group_id IN (SELECT id FROM device_groups WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()))
);
