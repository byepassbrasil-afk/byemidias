-- =====================================================
-- PHASE 2: Uptime Tracking + Partner Payments
-- =====================================================

-- 1. Uptime sessions - tracks each online period per device
CREATE TABLE IF NOT EXISTS device_uptime_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    partner_id UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
        ELSE NULL END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Partner payment settings
CREATE TABLE IF NOT EXISTS partner_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    payment_type TEXT NOT NULL DEFAULT 'hourly' CHECK (payment_type IN ('hourly', 'monthly')),
    hourly_rate NUMERIC(10, 2) DEFAULT 0,
    monthly_rate NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(partner_id, organization_id)
);

-- 3. Partner payment invoices
CREATE TABLE IF NOT EXISTS partner_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_hours NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_uptime_device ON device_uptime_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_uptime_partner ON device_uptime_sessions(partner_id);
CREATE INDEX IF NOT EXISTS idx_uptime_dates ON device_uptime_sessions(started_at, ended_at);
CREATE INDEX IF NOT EXISTS idx_uptime_org ON device_uptime_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_partner ON partner_invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON partner_invoices(period_start, period_end);

-- RLS policies
ALTER TABLE device_uptime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_invoices ENABLE ROW LEVEL SECURITY;

-- Uptime sessions: service_role full access, org read
CREATE POLICY "service_role_all_uptime" ON device_uptime_sessions FOR ALL
    USING (auth.role() = 'service_role');
CREATE POLICY "org_read_uptime" ON device_uptime_sessions FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Payments: service_role full access, org read
CREATE POLICY "service_role_all_payments" ON partner_payments FOR ALL
    USING (auth.role() = 'service_role');
CREATE POLICY "org_read_payments" ON partner_payments FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Invoices: service_role full access, org read
CREATE POLICY "service_role_all_invoices" ON partner_invoices FOR ALL
    USING (auth.role() = 'service_role');
CREATE POLICY "org_read_invoices" ON partner_invoices FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Function: auto-close stale uptime sessions (>5min since last heartbeat)
CREATE OR REPLACE FUNCTION close_stale_uptime_sessions()
RETURNS void AS $$
BEGIN
    UPDATE device_uptime_sessions
    SET ended_at = NOW()
    WHERE ended_at IS NULL
    AND started_at < NOW() - INTERVAL '5 minutes'
    AND device_id IN (
        SELECT id FROM devices
        WHERE last_heartbeat < NOW() - INTERVAL '5 minutes'
        OR last_heartbeat = '1970-01-01T00:00:00.000Z'
    );
END;
$$ LANGUAGE plpgsql;

-- Function: calculate uptime hours for a device in a date range
CREATE OR REPLACE FUNCTION get_device_uptime_hours(
    p_device_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC := 0;
    session RECORD;
BEGIN
    FOR session IN
        SELECT started_at, ended_at
        FROM device_uptime_sessions
        WHERE device_id = p_device_id
        AND started_at <= p_end
        AND (ended_at IS NULL OR ended_at >= p_start)
    LOOP
        total := total + EXTRACT(EPOCH FROM (
            LEAST(COALESCE(session.ended_at, NOW()), p_end)
            - GREATEST(session.started_at, p_start)
        )) / 3600.0;
    END LOOP;
    RETURN ROUND(total, 2);
END;
$$ LANGUAGE plpgsql;
