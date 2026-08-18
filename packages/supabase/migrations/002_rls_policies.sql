-- =====================================================
-- ByeMidias — Row Level Security Policies
-- Run AFTER 001_initial_schema.sql
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Helper: Get current user's organization
-- =====================================================
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- ORGANIZATIONS
-- =====================================================
-- Super admin: all
CREATE POLICY "super_admin_all_organizations" ON organizations
    FOR ALL USING (auth.user_role() = 'super_admin');

-- Users can see their own organization
CREATE POLICY "org_member_read" ON organizations
    FOR SELECT USING (
        id = auth.user_organization_id()
    );

-- =====================================================
-- PROFILES
-- =====================================================
CREATE POLICY "super_admin_all_profiles" ON profiles
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_profiles" ON profiles
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "user_read_own_profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "user_update_own_profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- =====================================================
-- UNITS
-- =====================================================
CREATE POLICY "super_admin_all_units" ON units
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_units" ON units
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_admin_manage_units" ON units
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager')
    );

-- =====================================================
-- DEVICE GROUPS
-- =====================================================
CREATE POLICY "super_admin_all_device_groups" ON device_groups
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_device_groups" ON device_groups
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_admin_manage_device_groups" ON device_groups
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager')
    );

-- =====================================================
-- DEVICES
-- =====================================================
CREATE POLICY "super_admin_all_devices" ON devices
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_devices" ON devices
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_admin_manage_devices" ON devices
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- MEDIA
-- =====================================================
CREATE POLICY "super_admin_all_media" ON media
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_media" ON media
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_operator_manage_media" ON media
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- PLAYLISTS
-- =====================================================
CREATE POLICY "super_admin_all_playlists" ON playlists
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_playlists" ON playlists
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_operator_manage_playlists" ON playlists
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- PLAYLIST ITEMS
-- =====================================================
CREATE POLICY "super_admin_all_playlist_items" ON playlist_items
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_playlist_items" ON playlist_items
    FOR SELECT USING (
        playlist_id IN (
            SELECT id FROM playlists WHERE organization_id = auth.user_organization_id()
        )
    );

CREATE POLICY "org_operator_manage_playlist_items" ON playlist_items
    FOR ALL USING (
        playlist_id IN (
            SELECT id FROM playlists WHERE organization_id = auth.user_organization_id()
        )
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- CAMPAIGNS
-- =====================================================
CREATE POLICY "super_admin_all_campaigns" ON campaigns
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_campaigns" ON campaigns
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_operator_manage_campaigns" ON campaigns
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- CAMPAIGN TARGETS
-- =====================================================
CREATE POLICY "super_admin_all_campaign_targets" ON campaign_targets
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_campaign_targets" ON campaign_targets
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE organization_id = auth.user_organization_id()
        )
    );

CREATE POLICY "org_operator_manage_campaign_targets" ON campaign_targets
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE organization_id = auth.user_organization_id()
        )
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- DEVICE HEARTBEATS
-- =====================================================
CREATE POLICY "super_admin_all_heartbeats" ON device_heartbeats
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_heartbeats" ON device_heartbeats
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE organization_id = auth.user_organization_id()
        )
    );

-- Service role inserts heartbeats via Edge Functions
CREATE POLICY "service_insert_heartbeats" ON device_heartbeats
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- SYNC LOGS
-- =====================================================
CREATE POLICY "super_admin_all_sync_logs" ON sync_logs
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_sync_logs" ON sync_logs
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE organization_id = auth.user_organization_id()
        )
    );

-- =====================================================
-- DEVICE COMMANDS
-- =====================================================
CREATE POLICY "super_admin_all_device_commands" ON device_commands
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_device_commands" ON device_commands
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE organization_id = auth.user_organization_id()
        )
    );

CREATE POLICY "org_admin_manage_device_commands" ON device_commands
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE organization_id = auth.user_organization_id()
        )
        AND auth.user_role() IN ('admin', 'manager')
    );

-- =====================================================
-- PLAYBACK LOGS
-- =====================================================
CREATE POLICY "super_admin_all_playback_logs" ON playback_logs
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_playback_logs" ON playback_logs
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE organization_id = auth.user_organization_id()
        )
    );

-- =====================================================
-- TEMPLATES
-- =====================================================
CREATE POLICY "super_admin_all_templates" ON templates
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_templates" ON templates
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_operator_manage_templates" ON templates
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- WIDGETS
-- =====================================================
CREATE POLICY "super_admin_all_widgets" ON widgets
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_member_read_widgets" ON widgets
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

CREATE POLICY "org_operator_manage_widgets" ON widgets
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager', 'operator')
    );

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE POLICY "super_admin_all_notifications" ON notifications
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "user_read_own_notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_update_own_notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE POLICY "super_admin_all_audit_logs" ON audit_logs
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_admin_read_audit_logs" ON audit_logs
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager')
    );

-- =====================================================
-- SUBSCRIPTIONS
-- =====================================================
CREATE POLICY "super_admin_all_subscriptions" ON subscriptions
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_admin_read_subscriptions" ON subscriptions
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'super_admin')
    );

-- =====================================================
-- WHITE LABEL SETTINGS
-- =====================================================
CREATE POLICY "super_admin_all_white_label" ON white_label_settings
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "org_admin_read_white_label" ON white_label_settings
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() = 'admin'
    );

CREATE POLICY "org_admin_manage_white_label" ON white_label_settings
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() = 'admin'
    );
