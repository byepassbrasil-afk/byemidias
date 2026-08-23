-- =====================================================
-- PHASE 3: Diagramação - Layout Templates
-- =====================================================

CREATE TABLE IF NOT EXISTS layout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    width INTEGER NOT NULL DEFAULT 1920,
    height INTEGER NOT NULL DEFAULT 1080,
    zones JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layout_org ON layout_templates(organization_id);

ALTER TABLE layout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_layouts" ON layout_templates FOR ALL
    USING (auth.role() = 'service_role');
CREATE POLICY "org_read_layouts" ON layout_templates FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
