-- ==========================================
-- SISTEMA DE CATEGORIAS PARA DISPOSITIVOS
-- ==========================================

-- Tabela principal de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL organization_id = categoria GLOBAL (visível para todas as orgs)
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT '🏷️',
  color TEXT DEFAULT '#6b7280',
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slug único por escopo (global vs local)
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_global_slug
  ON categories (slug) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_org_slug
  ON categories (organization_id, slug) WHERE organization_id IS NOT NULL;

-- Apenas uma categoria "default" por org + uma global
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_default_org
  ON categories (organization_id) WHERE is_default = TRUE AND organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_default_global
  ON categories (is_default) WHERE is_default = TRUE AND organization_id IS NULL;

-- ==========================================
-- DISPOSITIVO ↔ CATEGORIA
-- ==========================================
CREATE TABLE IF NOT EXISTS device_categories (
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  -- is_blocked = false: pode mostrar (whitelist)
  -- is_blocked = true: NÃO pode mostrar (blocklist / concorrente)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_device_categories_device ON device_categories(device_id);
CREATE INDEX IF NOT EXISTS idx_device_categories_category ON device_categories(category_id);

-- ==========================================
-- MÍDIA ↔ CATEGORIA
-- ==========================================
CREATE TABLE IF NOT EXISTS media_categories (
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (media_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_media_categories_media ON media_categories(media_id);
CREATE INDEX IF NOT EXISTS idx_media_categories_category ON media_categories(category_id);

-- ==========================================
-- OVERRIDES MANUAIS (apenas gestor)
-- ==========================================
ALTER TABLE devices ADD COLUMN IF NOT EXISTS category_overrides JSONB DEFAULT '{}';
-- Estrutura: { "<media_id>": { "force_show": true|false, "reason": "string", "by_user": "uuid", "at": "timestamp" } }

-- ==========================================
-- CATEGORIA DO PARCEIRO (1 categoria fixa)
-- ==========================================
ALTER TABLE partner_access ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ==========================================
-- SEED: categoria "Padrão" GLOBAL (id fixo)
-- ==========================================
INSERT INTO categories (id, organization_id, name, slug, icon, color, is_default, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'Padrão',
  'padrao',
  '🏷️',
  '#6b7280',
  TRUE,
  'Categoria padrão atribuída automaticamente a mídias sem categoria'
)
ON CONFLICT DO NOTHING;

-- ==========================================
-- TRIGGER: cria categoria "Padrão" local quando org é criada
-- ==========================================
CREATE OR REPLACE FUNCTION create_org_default_category()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (organization_id, name, slug, icon, color, is_default, description)
  VALUES (
    NEW.id,
    'Padrão',
    'padrao-' || LOWER(REPLACE(NEW.id::text, '-', '')),
    '🏷️',
    '#6b7280',
    TRUE,
    'Categoria padrão da organização'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_org_default_category ON organizations;
CREATE TRIGGER trg_create_org_default_category
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION create_org_default_category();

-- Backfill: cria "Padrão" para todas as orgs existentes
INSERT INTO categories (organization_id, name, slug, icon, color, is_default, description)
SELECT o.id, 'Padrão', 'padrao-' || LOWER(REPLACE(o.id::text, '-', '')), '🏷️', '#6b7280', TRUE, 'Categoria padrão da organização'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.organization_id = o.id AND c.is_default = TRUE
)
ON CONFLICT DO NOTHING;

-- ==========================================
-- TRIGGER: mídia sem categoria → atribui "Padrão" da org (ou global)
-- ==========================================
CREATE OR REPLACE FUNCTION auto_assign_default_category()
RETURNS TRIGGER AS $$
DECLARE
  default_cat_id UUID;
BEGIN
  -- Se já tem categoria, não faz nada
  IF EXISTS (SELECT 1 FROM media_categories WHERE media_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Tenta primeiro a categoria default da org do media
  SELECT id INTO default_cat_id FROM categories
  WHERE is_default = TRUE
    AND organization_id = (SELECT organization_id FROM media WHERE id = NEW.id)
  LIMIT 1;

  -- Se não, usa a global
  IF default_cat_id IS NULL THEN
    SELECT id INTO default_cat_id FROM categories
    WHERE is_default = TRUE AND organization_id IS NULL
    LIMIT 1;
  END IF;

  IF default_cat_id IS NOT NULL THEN
    INSERT INTO media_categories (media_id, category_id)
    VALUES (NEW.id, default_cat_id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_media_category ON media;
CREATE TRIGGER trg_auto_assign_media_category
AFTER INSERT ON media
FOR EACH ROW EXECUTE FUNCTION auto_assign_default_category();

-- ==========================================
-- MIGRATION RETROATIVA: atribui "Padrão" a todas mídias existentes sem categoria
-- ==========================================
INSERT INTO media_categories (media_id, category_id)
SELECT m.id, c.id
FROM media m
CROSS JOIN categories c
WHERE c.is_default = TRUE
  AND c.organization_id IS NULL  -- global "Padrão"
  AND NOT EXISTS (SELECT 1 FROM media_categories mc WHERE mc.media_id = m.id)
ON CONFLICT DO NOTHING;

-- Para mídias com org, atribuir a "Padrão" da org
INSERT INTO media_categories (media_id, category_id)
SELECT m.id, c.id
FROM media m
INNER JOIN categories c ON c.organization_id = m.organization_id AND c.is_default = TRUE
WHERE NOT EXISTS (SELECT 1 FROM media_categories mc WHERE mc.media_id = m.id)
ON CONFLICT DO NOTHING;
