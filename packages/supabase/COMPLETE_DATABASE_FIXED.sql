-- =====================================================
-- ByeMidias — PART 1: Tables, indexes, functions (no auth refs)
-- Execute PRIMEIRO no Supabase SQL Editor
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'manager', 'operator', 'viewer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_uuid TEXT UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    group_id UUID REFERENCES device_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    model TEXT,
    manufacturer TEXT,
    os_version TEXT,
    player_version TEXT,
    resolution TEXT,
    orientation TEXT DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    status TEXT DEFAULT 'inactive' CHECK (status IN ('online', 'offline', 'syncing', 'error', 'inactive')),
    last_heartbeat TIMESTAMPTZ,
    last_sync TIMESTAMPTZ,
    ip_address TEXT,
    storage_total BIGINT,
    storage_used BIGINT,
    activation_code TEXT,
    activation_expires_at TIMESTAMPTZ,
    is_activated BOOLEAN DEFAULT false,
    content_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'gif', 'pdf', 'html', 'url', 'text', 'template', 'widget')),
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    duration INTEGER,
    transition TEXT DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended', 'archived')),
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6,0}',
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('unit', 'group', 'device')),
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    player_version TEXT,
    status TEXT CHECK (status IN ('online', 'offline', 'syncing', 'error')),
    storage_available BIGINT,
    current_content TEXT,
    current_playlist TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    content_version INTEGER,
    status TEXT CHECK (status IN ('success', 'partial', 'failed')),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    command TEXT NOT NULL CHECK (command IN ('restart', 'sync', 'update_playlist', 'clear_cache', 'update_app', 'reload_content', 'reboot', 'capture_info')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'executed', 'failed', 'timeout')),
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS playback_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    layout_json JSONB DEFAULT '{"width": 1920, "height": 1080, "elements": []}',
    thumbnail_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL CHECK (widget_type IN ('weather', 'news', 'clock', 'web_page', 'dynamic_text', 'qr_code', 'lottery', 'indicator')),
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    max_devices INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 5,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS white_label_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    partner_name TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#1E40AF',
    custom_domain TEXT,
    subdomain TEXT UNIQUE,
    login_background_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_access_id, device_id)
);

CREATE TABLE IF NOT EXISTS partner_media_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_units_organization ON units(organization_id);
CREATE INDEX IF NOT EXISTS idx_units_city ON units(city);
CREATE INDEX IF NOT EXISTS idx_device_groups_organization ON device_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_groups_unit ON device_groups(unit_id);
CREATE INDEX IF NOT EXISTS idx_devices_organization ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_unit ON devices(unit_id);
CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_activation_code ON devices(activation_code);
CREATE INDEX IF NOT EXISTS idx_devices_device_uuid ON devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_devices_org_status ON devices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_org_unit ON devices(organization_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_media_organization ON media(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_org_type ON media(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_playlists_organization ON playlists(organization_id);
CREATE INDEX IF NOT EXISTS idx_playlists_org_status ON playlists(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_media ON playlist_items(media_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON campaigns(priority);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_target ON campaign_targets(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_device ON device_heartbeats(device_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON device_heartbeats(timestamp);
CREATE INDEX IF NOT EXISTS idx_heartbeats_device_time ON device_heartbeats(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_device ON sync_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_commands_device ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_commands_status ON device_commands(status);
CREATE INDEX IF NOT EXISTS idx_playback_device ON playback_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_playback_started ON playback_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_playback_device_time ON playback_logs(device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_organization ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_widgets_organization ON widgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_audit_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_white_label_organization ON white_label_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_white_label_subdomain ON white_label_settings(subdomain);
CREATE INDEX IF NOT EXISTS idx_partner_access_organization ON partner_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_access_username ON partner_access(username);
CREATE INDEX IF NOT EXISTS idx_partner_access_status ON partner_access(status);
CREATE INDEX IF NOT EXISTS idx_partner_devices_partner ON partner_devices(partner_access_id);
CREATE INDEX IF NOT EXISTS idx_partner_devices_device ON partner_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_partner_media_uploads_partner ON partner_media_uploads(partner_access_id);
CREATE INDEX IF NOT EXISTS idx_partner_media_uploads_media ON partner_media_uploads(media_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (organization_id, plan, status, max_devices, max_storage_gb)
    VALUES (NEW.id, 'free', 'active', 10, 5);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (NEW.organization_id, NULL, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (NEW.organization_id, NULL, 'UPDATE', TG_TABLE_NAME, NEW.id, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
        VALUES (OLD.organization_id, NULL, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_offline_devices()
RETURNS void AS $$
BEGIN
    UPDATE devices SET status = 'offline' WHERE status = 'online' AND last_heartbeat < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_content_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE devices SET content_version = content_version + 1 WHERE organization_id = NEW.organization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION hash_partner_password(p_password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(p_password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_partner_password(p_password TEXT, p_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(p_password, p_hash) = p_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS helper functions (public schema — pooler can create these)
CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
    AFTER INSERT ON organizations
    FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_media_updated_at ON media;
CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_playlists_updated_at ON playlists;
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_widgets_updated_at ON widgets;
CREATE TRIGGER update_widgets_updated_at BEFORE UPDATE ON widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_white_label_updated_at ON white_label_settings;
CREATE TRIGGER update_white_label_updated_at BEFORE UPDATE ON white_label_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_partner_access_updated_at ON partner_access;
CREATE TRIGGER update_partner_access_updated_at BEFORE UPDATE ON partner_access FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS audit_devices ON devices;
CREATE TRIGGER audit_devices AFTER INSERT OR UPDATE OR DELETE ON devices FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS audit_campaigns ON campaigns;
CREATE TRIGGER audit_campaigns AFTER INSERT OR UPDATE OR DELETE ON campaigns FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS audit_playlists ON playlists;
CREATE TRIGGER audit_playlists AFTER INSERT OR UPDATE OR DELETE ON playlists FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS audit_media ON media;
CREATE TRIGGER audit_media AFTER INSERT OR UPDATE OR DELETE ON media FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS audit_partner_access ON partner_access;
CREATE TRIGGER audit_partner_access AFTER INSERT OR UPDATE OR DELETE ON partner_access FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS on_playlist_updated ON playlists;
CREATE TRIGGER on_playlist_updated
    AFTER UPDATE ON playlists
    FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW)
    EXECUTE FUNCTION increment_content_version();

DROP TRIGGER IF EXISTS on_campaign_status_changed ON campaigns;
CREATE TRIGGER on_campaign_status_changed
    AFTER UPDATE ON campaigns
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION increment_content_version();

-- =====================================================
-- RLS
-- =====================================================

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
ALTER TABLE partner_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_media_uploads ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS
DROP POLICY IF EXISTS "super_admin_all_organizations" ON organizations;
CREATE POLICY "super_admin_all_organizations" ON organizations FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read" ON organizations;
CREATE POLICY "org_member_read" ON organizations FOR SELECT USING (id = public.user_organization_id());

-- PROFILES
DROP POLICY IF EXISTS "super_admin_all_profiles" ON profiles;
CREATE POLICY "super_admin_all_profiles" ON profiles FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_profiles" ON profiles;
CREATE POLICY "org_member_read_profiles" ON profiles FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "user_read_own_profile" ON profiles;
CREATE POLICY "user_read_own_profile" ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "user_update_own_profile" ON profiles;
CREATE POLICY "user_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- UNITS
DROP POLICY IF EXISTS "super_admin_all_units" ON units;
CREATE POLICY "super_admin_all_units" ON units FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_units" ON units;
CREATE POLICY "org_member_read_units" ON units FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_admin_manage_units" ON units;
CREATE POLICY "org_admin_manage_units" ON units FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager'));

-- DEVICE GROUPS
DROP POLICY IF EXISTS "super_admin_all_device_groups" ON device_groups;
CREATE POLICY "super_admin_all_device_groups" ON device_groups FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_device_groups" ON device_groups;
CREATE POLICY "org_member_read_device_groups" ON device_groups FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_admin_manage_device_groups" ON device_groups;
CREATE POLICY "org_admin_manage_device_groups" ON device_groups FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager'));

-- DEVICES
DROP POLICY IF EXISTS "super_admin_all_devices" ON devices;
CREATE POLICY "super_admin_all_devices" ON devices FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_devices" ON devices;
CREATE POLICY "org_member_read_devices" ON devices FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_admin_manage_devices" ON devices;
CREATE POLICY "org_admin_manage_devices" ON devices FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- MEDIA
DROP POLICY IF EXISTS "super_admin_all_media" ON media;
CREATE POLICY "super_admin_all_media" ON media FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_media" ON media;
CREATE POLICY "org_member_read_media" ON media FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_operator_manage_media" ON media;
CREATE POLICY "org_operator_manage_media" ON media FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- PLAYLISTS
DROP POLICY IF EXISTS "super_admin_all_playlists" ON playlists;
CREATE POLICY "super_admin_all_playlists" ON playlists FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_playlists" ON playlists;
CREATE POLICY "org_member_read_playlists" ON playlists FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_operator_manage_playlists" ON playlists;
CREATE POLICY "org_operator_manage_playlists" ON playlists FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- PLAYLIST ITEMS
DROP POLICY IF EXISTS "super_admin_all_playlist_items" ON playlist_items;
CREATE POLICY "super_admin_all_playlist_items" ON playlist_items FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_playlist_items" ON playlist_items;
CREATE POLICY "org_member_read_playlist_items" ON playlist_items FOR SELECT USING (playlist_id IN (SELECT id FROM playlists WHERE organization_id = public.user_organization_id()));
DROP POLICY IF EXISTS "org_operator_manage_playlist_items" ON playlist_items;
CREATE POLICY "org_operator_manage_playlist_items" ON playlist_items FOR ALL USING (playlist_id IN (SELECT id FROM playlists WHERE organization_id = public.user_organization_id()) AND public.user_role() IN ('admin', 'manager', 'operator'));

-- CAMPAIGNS
DROP POLICY IF EXISTS "super_admin_all_campaigns" ON campaigns;
CREATE POLICY "super_admin_all_campaigns" ON campaigns FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_campaigns" ON campaigns;
CREATE POLICY "org_member_read_campaigns" ON campaigns FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_operator_manage_campaigns" ON campaigns;
CREATE POLICY "org_operator_manage_campaigns" ON campaigns FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- CAMPAIGN TARGETS
DROP POLICY IF EXISTS "super_admin_all_campaign_targets" ON campaign_targets;
CREATE POLICY "super_admin_all_campaign_targets" ON campaign_targets FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_campaign_targets" ON campaign_targets;
CREATE POLICY "org_member_read_campaign_targets" ON campaign_targets FOR SELECT USING (campaign_id IN (SELECT id FROM campaigns WHERE organization_id = public.user_organization_id()));
DROP POLICY IF EXISTS "org_operator_manage_campaign_targets" ON campaign_targets;
CREATE POLICY "org_operator_manage_campaign_targets" ON campaign_targets FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE organization_id = public.user_organization_id()) AND public.user_role() IN ('admin', 'manager', 'operator'));

-- HEARTBEATS
DROP POLICY IF EXISTS "super_admin_all_heartbeats" ON device_heartbeats;
CREATE POLICY "super_admin_all_heartbeats" ON device_heartbeats FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_heartbeats" ON device_heartbeats;
CREATE POLICY "org_member_read_heartbeats" ON device_heartbeats FOR SELECT USING (device_id IN (SELECT id FROM devices WHERE organization_id = public.user_organization_id()));
DROP POLICY IF EXISTS "service_insert_heartbeats" ON device_heartbeats;
CREATE POLICY "service_insert_heartbeats" ON device_heartbeats FOR INSERT WITH CHECK (true);

-- SYNC LOGS
DROP POLICY IF EXISTS "super_admin_all_sync_logs" ON sync_logs;
CREATE POLICY "super_admin_all_sync_logs" ON sync_logs FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_sync_logs" ON sync_logs;
CREATE POLICY "org_member_read_sync_logs" ON sync_logs FOR SELECT USING (device_id IN (SELECT id FROM devices WHERE organization_id = public.user_organization_id()));

-- DEVICE COMMANDS
DROP POLICY IF EXISTS "super_admin_all_device_commands" ON device_commands;
CREATE POLICY "super_admin_all_device_commands" ON device_commands FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_device_commands" ON device_commands;
CREATE POLICY "org_member_read_device_commands" ON device_commands FOR SELECT USING (device_id IN (SELECT id FROM devices WHERE organization_id = public.user_organization_id()));
DROP POLICY IF EXISTS "org_admin_manage_device_commands" ON device_commands;
CREATE POLICY "org_admin_manage_device_commands" ON device_commands FOR INSERT WITH CHECK (device_id IN (SELECT id FROM devices WHERE organization_id = public.user_organization_id()) AND public.user_role() IN ('admin', 'manager'));

-- PLAYBACK LOGS
DROP POLICY IF EXISTS "super_admin_all_playback_logs" ON playback_logs;
CREATE POLICY "super_admin_all_playback_logs" ON playback_logs FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_playback_logs" ON playback_logs;
CREATE POLICY "org_member_read_playback_logs" ON playback_logs FOR SELECT USING (device_id IN (SELECT id FROM devices WHERE organization_id = public.user_organization_id()));

-- TEMPLATES
DROP POLICY IF EXISTS "super_admin_all_templates" ON templates;
CREATE POLICY "super_admin_all_templates" ON templates FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_templates" ON templates;
CREATE POLICY "org_member_read_templates" ON templates FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_operator_manage_templates" ON templates;
CREATE POLICY "org_operator_manage_templates" ON templates FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- WIDGETS
DROP POLICY IF EXISTS "super_admin_all_widgets" ON widgets;
CREATE POLICY "super_admin_all_widgets" ON widgets FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_member_read_widgets" ON widgets;
CREATE POLICY "org_member_read_widgets" ON widgets FOR SELECT USING (organization_id = public.user_organization_id());
DROP POLICY IF EXISTS "org_operator_manage_widgets" ON widgets;
CREATE POLICY "org_operator_manage_widgets" ON widgets FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager', 'operator'));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "super_admin_all_notifications" ON notifications;
CREATE POLICY "super_admin_all_notifications" ON notifications FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "user_read_own_notifications" ON notifications;
CREATE POLICY "user_read_own_notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_update_own_notifications" ON notifications;
CREATE POLICY "user_update_own_notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOGS
DROP POLICY IF EXISTS "super_admin_all_audit_logs" ON audit_logs;
CREATE POLICY "super_admin_all_audit_logs" ON audit_logs FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_read_audit_logs" ON audit_logs;
CREATE POLICY "org_admin_read_audit_logs" ON audit_logs FOR SELECT USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager'));

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "super_admin_all_subscriptions" ON subscriptions;
CREATE POLICY "super_admin_all_subscriptions" ON subscriptions FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_read_subscriptions" ON subscriptions;
CREATE POLICY "org_admin_read_subscriptions" ON subscriptions FOR SELECT USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'super_admin'));

-- WHITE LABEL
DROP POLICY IF EXISTS "super_admin_all_white_label" ON white_label_settings;
CREATE POLICY "super_admin_all_white_label" ON white_label_settings FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_read_white_label" ON white_label_settings;
CREATE POLICY "org_admin_read_white_label" ON white_label_settings FOR SELECT USING (organization_id = public.user_organization_id() AND public.user_role() = 'admin');
DROP POLICY IF EXISTS "org_admin_manage_white_label" ON white_label_settings;
CREATE POLICY "org_admin_manage_white_label" ON white_label_settings FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() = 'admin');

-- PARTNER ACCESS
DROP POLICY IF EXISTS "super_admin_all_partner_access" ON partner_access;
CREATE POLICY "super_admin_all_partner_access" ON partner_access FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_manage_partner_access" ON partner_access;
CREATE POLICY "org_admin_manage_partner_access" ON partner_access FOR ALL USING (organization_id = public.user_organization_id() AND public.user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "org_member_read_partner_access" ON partner_access;
CREATE POLICY "org_member_read_partner_access" ON partner_access FOR SELECT USING (organization_id = public.user_organization_id());

-- PARTNER DEVICES
DROP POLICY IF EXISTS "super_admin_all_partner_devices" ON partner_devices;
CREATE POLICY "super_admin_all_partner_devices" ON partner_devices FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_manage_partner_devices" ON partner_devices;
CREATE POLICY "org_admin_manage_partner_devices" ON partner_devices FOR ALL USING (partner_access_id IN (SELECT id FROM partner_access WHERE organization_id = public.user_organization_id()) AND public.user_role() IN ('admin', 'manager'));

-- PARTNER MEDIA UPLOADS
DROP POLICY IF EXISTS "super_admin_all_partner_media_uploads" ON partner_media_uploads;
CREATE POLICY "super_admin_all_partner_media_uploads" ON partner_media_uploads FOR ALL USING (public.user_role() = 'super_admin');
DROP POLICY IF EXISTS "org_admin_manage_partner_media_uploads" ON partner_media_uploads;
CREATE POLICY "org_admin_manage_partner_media_uploads" ON partner_media_uploads FOR ALL USING (partner_access_id IN (SELECT id FROM partner_access WHERE organization_id = public.user_organization_id()) AND public.user_role() IN ('admin', 'manager'));
