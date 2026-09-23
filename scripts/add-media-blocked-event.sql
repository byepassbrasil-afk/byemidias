-- Add 'media_blocked' to allowed event_type values in device_logs
ALTER TABLE device_logs DROP CONSTRAINT IF EXISTS device_logs_event_type_check;
ALTER TABLE device_logs ADD CONSTRAINT device_logs_event_type_check
  CHECK (event_type = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'heartbeat'::text, 'disconnect'::text, 'sync'::text, 'activation'::text, 'media_blocked'::text, 'media_unblocked'::text]));
