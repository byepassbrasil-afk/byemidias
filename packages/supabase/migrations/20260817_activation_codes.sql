-- Migration: Add activation codes table for device activation
-- Run this on Supabase SQL Editor

-- 1. Create activation_codes table
CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- 2. Create index
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);

-- 3. Add activation_code to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS activation_code TEXT;

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON activation_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON activation_codes TO authenticated;
