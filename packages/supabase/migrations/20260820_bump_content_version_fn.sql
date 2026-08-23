CREATE OR REPLACE FUNCTION bump_device_content_version(target_device_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE devices
  SET content_version = content_version + 1,
      updated_at = NOW()
  WHERE id = target_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
