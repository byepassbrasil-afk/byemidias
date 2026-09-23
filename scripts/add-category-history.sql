-- Tabela de histórico de categorias
CREATE TABLE IF NOT EXISTS category_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- blocked, allowed, override_blocked, override_allowed
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_history_device_id ON category_history(device_id);
CREATE INDEX IF NOT EXISTS idx_category_history_media_id ON category_history(media_id);
CREATE INDEX IF NOT EXISTS idx_category_history_created_at ON category_history(created_at);

-- Tabela auxiliar de estado atual para evitar duplicação no mesmo sync
CREATE TABLE IF NOT EXISTS category_history_sync_state (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_blocked_hash TEXT
);

COMMENT ON TABLE category_history IS 'Audit trail de bloqueios e desbloqueios de mídia por categoria';
