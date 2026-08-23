-- Device features: restart, rotation, mirror, support ID, volume
ALTER TABLE devices ADD COLUMN IF NOT EXISTS screen_rotation INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS mirror_horizontal BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS mirror_vertical BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS support_id TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS support_type TEXT DEFAULT 'anydesk';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS restart_requested BOOLEAN DEFAULT false;

-- Playlist items: volume per item
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS volume INTEGER DEFAULT 100;

-- Campaign time slots
CREATE TABLE IF NOT EXISTS campaign_time_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_time_slots_campaign ON campaign_time_slots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_time_slots_day ON campaign_time_slots(day_of_week);

-- Campaign calendar events
CREATE TABLE IF NOT EXISTS campaign_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    all_day BOOLEAN DEFAULT false,
    start_time TIME,
    end_time TIME,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_calendar_dates ON campaign_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaign_calendar_campaign ON campaign_calendar(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calendar_device ON campaign_calendar(device_id);
