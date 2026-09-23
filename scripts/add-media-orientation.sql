ALTER TABLE media ADD COLUMN IF NOT EXISTS default_orientation TEXT DEFAULT 'auto' CHECK (default_orientation IN ('auto', 'portrait', 'landscape'));
ALTER TABLE media ADD COLUMN IF NOT EXISTS display_name TEXT;
UPDATE media SET display_name = name WHERE display_name IS NULL;
