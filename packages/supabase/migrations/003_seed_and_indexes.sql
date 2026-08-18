-- =====================================================
-- ByeMidias — Seed Data & Extra Indexes
-- Run AFTER 002_rls_policies.sql
-- =====================================================

-- =====================================================
-- EXTRA INDEXES for performance
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_devices_org_status ON devices(organization_id, status);
CREATE INDEX idx_devices_org_unit ON devices(organization_id, unit_id);
CREATE INDEX idx_campaigns_org_status ON campaigns(organization_id, status);
CREATE INDEX idx_media_org_type ON media(organization_id, type);
CREATE INDEX idx_playlists_org_status ON playlists(organization_id, status);
CREATE INDEX idx_heartbeats_device_time ON device_heartbeats(device_id, timestamp DESC);
CREATE INDEX idx_playback_device_time ON playback_logs(device_id, started_at DESC);

-- =====================================================
-- DEFAULT SUPER ADMIN USER
-- =====================================================
-- IMPORTANT: Replace the UUID below with your actual auth.users UUID
-- after creating your first user via Supabase Auth signup

-- Example (run after creating user):
-- INSERT INTO profiles (id, organization_id, full_name, role, status)
-- VALUES (
--     'YOUR-AUTH-USER-UUID-HERE',
--     NULL,
--     'Super Admin',
--     'super_admin',
--     'active'
-- );

-- =====================================================
-- DEFAULT SUBSCRIPTION FOR NEW ORGS
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (organization_id, plan, status, max_devices, max_storage_gb)
    VALUES (NEW.id, 'free', 'active', 10, 5);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();

-- =====================================================
-- AUDIT LOG TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(NEW.organization_id, (SELECT organization_id FROM profiles WHERE id = auth.uid())),
            auth.uid(),
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(NEW.organization_id, (SELECT organization_id FROM profiles WHERE id = auth.uid())),
            auth.uid(),
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(OLD.organization_id, (SELECT organization_id FROM profiles WHERE id = auth.uid())),
            auth.uid(),
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_devices AFTER INSERT OR UPDATE OR DELETE ON devices
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_campaigns AFTER INSERT OR UPDATE OR DELETE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_playlists AFTER INSERT OR UPDATE OR DELETE ON playlists
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_media AFTER INSERT OR UPDATE OR DELETE ON media
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- =====================================================
-- AUTO-MARK OFFLINE DEVICES
-- =====================================================
CREATE OR REPLACE FUNCTION mark_offline_devices()
RETURNS void AS $$
BEGIN
    UPDATE devices
    SET status = 'offline'
    WHERE status = 'online'
    AND last_heartbeat < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CONTENT VERSION INCREMENT
-- =====================================================
CREATE OR REPLACE FUNCTION increment_content_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE devices
    SET content_version = content_version + 1
    WHERE organization_id = NEW.organization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_playlist_updated
    AFTER UPDATE ON playlists
    FOR EACH ROW
    WHEN (OLD IS DISTINCT FROM NEW)
    EXECUTE FUNCTION increment_content_version();

CREATE TRIGGER on_campaign_status_changed
    AFTER UPDATE ON campaigns
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION increment_content_version();
