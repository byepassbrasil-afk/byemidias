-- ==========================================
-- Helper: Ensure every org has a 'Padrão' category
-- Run on-demand or via cron
-- ==========================================
INSERT INTO categories (organization_id, name, slug, icon, color, is_default, description)
SELECT
  o.id,
  'Padrão',
  'padrao-' || LOWER(REPLACE(o.id::text, '-', '')),
  '🏷️',
  '#6b7280',
  TRUE,
  'Categoria padrão da organização (criada por helper)'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.is_default = TRUE
)
ON CONFLICT DO NOTHING;

-- Report: show how many orgs had Padrão created
DO $$
DECLARE
  created_count INT;
BEGIN
  GET DIAGNOSTICS created_count = ROW_COUNT;
  RAISE NOTICE 'Padrão categories ensured for all orgs (rows processed: %)', created_count;
END $$;
