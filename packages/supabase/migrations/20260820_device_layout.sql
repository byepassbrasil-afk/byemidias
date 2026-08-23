ALTER TABLE devices ADD COLUMN IF NOT EXISTS layout_template_id UUID REFERENCES layout_templates(id);
CREATE INDEX IF NOT EXISTS idx_device_layout ON devices(layout_template_id);
