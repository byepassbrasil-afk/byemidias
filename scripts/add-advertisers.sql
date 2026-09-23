-- Anunciantes: 4 tabelas

-- 1. advertisers
CREATE TABLE IF NOT EXISTS advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    establishment_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    document VARCHAR(50),
    address TEXT,
    ticket_value DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisers_org ON advertisers(organization_id);

-- 2. advertiser_devices
CREATE TABLE IF NOT EXISTS advertiser_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    contracted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(advertiser_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_advertiser_devices_advertiser ON advertiser_devices(advertiser_id);

-- 3. advertiser_media
CREATE TABLE IF NOT EXISTS advertiser_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'image',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertiser_media_advertiser ON advertiser_media(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_media_org ON advertiser_media(organization_id);

-- 4. advertiser_invoices
CREATE TABLE IF NOT EXISTS advertiser_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE,
    period_end DATE,
    amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertiser_invoices_advertiser ON advertiser_invoices(advertiser_id);

COMMENT ON TABLE advertisers IS 'Anunciantes (clientes que contratam propaganda nos dispositivos)';
COMMENT ON TABLE advertiser_devices IS 'Relação entre anunciante e dispositivos onde seus anúncios são exibidos';
COMMENT ON TABLE advertiser_media IS 'Mídias próprias do anunciante (upload próprio)';
COMMENT ON TABLE advertiser_invoices IS 'Faturas/boletos dos anunciantes';
