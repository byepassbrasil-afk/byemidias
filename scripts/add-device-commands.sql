-- Device commands table for remote control from dashboard
-- Allows sending commands to a device that will be picked up on next heartbeat

CREATE TABLE IF NOT EXISTS device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device_pending
  ON device_commands (device_id, executed_at)
  WHERE executed_at IS NULL;

COMMENT ON TABLE device_commands IS 'Remote commands sent to devices, picked up on next heartbeat';
COMMENT ON COLUMN device_commands.command IS 'open_config | rotate | rotate_portrait | rotate_landscape | restart | reload | clear_cache | toggle_kiosk';
