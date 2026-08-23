-- Content version bumping on playlist/media changes
-- When playlists or media change, bump content_version on all devices in the same org
-- This forces APKs to re-sync on next heartbeat

CREATE OR REPLACE FUNCTION bump_device_content_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Bump content_version on all devices in the same organization
    UPDATE devices
    SET content_version = content_version + 1,
        updated_at = NOW()
    WHERE organization_id = (
        SELECT organization_id FROM playlists WHERE id = COALESCE(NEW.playlist_id, OLD.playlist_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on playlist_items (insert/update/delete)
CREATE OR REPLACE TRIGGER on_playlist_item_change
    AFTER INSERT OR UPDATE OR DELETE ON playlist_items
    FOR EACH ROW
    EXECUTE FUNCTION bump_device_content_version();

-- Trigger on playlists (update status, name, etc.)
CREATE OR REPLACE TRIGGER on_playlist_change
    AFTER UPDATE ON playlists
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION bump_device_content_version();

-- Trigger on media (insert/update/delete)
CREATE OR REPLACE TRIGGER on_media_change
    AFTER INSERT OR UPDATE OR DELETE ON media
    FOR EACH ROW
    EXECUTE FUNCTION bump_device_content_version();
