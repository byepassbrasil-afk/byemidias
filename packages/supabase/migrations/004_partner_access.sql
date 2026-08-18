-- =====================================================
-- ByeMidias — Partner Access (simple login, no OAuth)
-- Run AFTER 003_seed_and_indexes.sql
-- =====================================================

-- Enable pgcrypto for crypt() function
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. PARTNER ACCESS (simple credentials)
-- =====================================================
CREATE TABLE partner_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_access_organization ON partner_access(organization_id);
CREATE INDEX idx_partner_access_username ON partner_access(username);
CREATE INDEX idx_partner_access_status ON partner_access(status);

-- =====================================================
-- 2. PARTNER DEVICES (which devices partner can manage)
-- =====================================================
CREATE TABLE partner_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_access_id, device_id)
);

CREATE INDEX idx_partner_devices_partner ON partner_devices(partner_access_id);
CREATE INDEX idx_partner_devices_device ON partner_devices(device_id);

-- =====================================================
-- 3. PARTNER MEDIA UPLOADS (track what partner uploaded)
-- =====================================================
CREATE TABLE partner_media_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_media_uploads_partner ON partner_media_uploads(partner_access_id);
CREATE INDEX idx_partner_media_uploads_media ON partner_media_uploads(media_id);

-- =====================================================
-- HELPER FUNCTIONS for password hashing
-- =====================================================

-- Hash a password using pgcrypto
CREATE OR REPLACE FUNCTION hash_partner_password(p_password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(p_password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify password against hash
CREATE OR REPLACE FUNCTION verify_partner_password(p_password TEXT, p_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(p_password, p_hash) = p_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES for partner tables
-- =====================================================
ALTER TABLE partner_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_media_uploads ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "super_admin_all_partner_access" ON partner_access
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "super_admin_all_partner_devices" ON partner_devices
    FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "super_admin_all_partner_media_uploads" ON partner_media_uploads
    FOR ALL USING (auth.user_role() = 'super_admin');

-- Org admin/manager: manage partners in their org
CREATE POLICY "org_admin_manage_partner_access" ON partner_access
    FOR ALL USING (
        organization_id = auth.user_organization_id()
        AND auth.user_role() IN ('admin', 'manager')
    );

CREATE POLICY "org_admin_manage_partner_devices" ON partner_devices
    FOR ALL USING (
        partner_access_id IN (
            SELECT id FROM partner_access
            WHERE organization_id = auth.user_organization_id()
        )
        AND auth.user_role() IN ('admin', 'manager')
    );

CREATE POLICY "org_admin_manage_partner_media_uploads" ON partner_media_uploads
    FOR ALL USING (
        partner_access_id IN (
            SELECT id FROM partner_access
            WHERE organization_id = auth.user_organization_id()
        )
        AND auth.user_role() IN ('admin', 'manager')
    );

-- Org member: read partners in their org
CREATE POLICY "org_member_read_partner_access" ON partner_access
    FOR SELECT USING (
        organization_id = auth.user_organization_id()
    );

-- =====================================================
-- UPDATED_AT trigger for partner_access
-- =====================================================
CREATE TRIGGER update_partner_access_updated_at BEFORE UPDATE ON partner_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- AUDIT LOG trigger for partner_access
-- =====================================================
CREATE TRIGGER audit_partner_access AFTER INSERT OR UPDATE OR DELETE ON partner_access
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
