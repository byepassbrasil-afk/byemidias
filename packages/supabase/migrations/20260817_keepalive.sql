-- Migration: Add keepalive_log table to prevent Supabase hibernation
-- Run this on Supabase SQL Editor

-- 1. Create keepalive_log table
CREATE TABLE IF NOT EXISTS keepalive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_count INTEGER DEFAULT 0,
  response_ms INTEGER DEFAULT 0
);

-- 2. Create index for fast cleanup
CREATE INDEX IF NOT EXISTS idx_keepalive_log_checked_at ON keepalive_log(checked_at);

-- 3. Enable RLS (but allow all for service_role)
ALTER TABLE keepalive_log ENABLE ROW LEVEL SECURITY;

-- 4. Create policy for service_role
CREATE POLICY "Service role can do everything" ON keepalive_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Grant permissions
GRANT SELECT, INSERT, DELETE ON keepalive_log TO service_role;
