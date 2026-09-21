-- Adiciona agrupamento (pastas) para devices
-- Cada device pode pertencer a um grupo (pasta) para melhor organização
-- group_id (FK para device_groups) + group_name (denormalized para performance)

CREATE TABLE IF NOT EXISTS device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#ee6a1e',
  icon TEXT DEFAULT '📁',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_groups_org ON device_groups(organization_id, position);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES device_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
