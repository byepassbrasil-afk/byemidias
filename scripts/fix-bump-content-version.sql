-- Fix the trigger function for playlists/playlist_items/playlist_slots/playlist_slots
-- The previous version incorrectly used NEW.playlist_id on playlists table,
-- which doesn't have that column. The playlists table has 'id' instead.

CREATE OR REPLACE FUNCTION public.bump_device_content_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    org_id uuid;
    ref_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'playlist_items' OR TG_TABLE_NAME = 'playlist_slots' THEN
        -- playlist_items and playlist_slots have playlist_id column
        IF TG_OP = 'DELETE' THEN
            ref_id := OLD.playlist_id;
        ELSE
            ref_id := NEW.playlist_id;
        END IF;
        org_id := (SELECT organization_id FROM playlists WHERE id = ref_id);
        UPDATE devices SET content_version = content_version + 1 WHERE organization_id = org_id;
    ELSIF TG_TABLE_NAME = 'playlists' THEN
        -- playlists has 'id' (no playlist_id column)
        IF TG_OP = 'DELETE' THEN
            ref_id := OLD.id;
        ELSE
            ref_id := NEW.id;
        END IF;
        org_id := (SELECT organization_id FROM playlists WHERE id = ref_id);
        UPDATE devices SET content_version = content_version + 1 WHERE organization_id = org_id;
    ELSIF TG_TABLE_NAME = 'media' THEN
        IF TG_OP = 'DELETE' THEN
            UPDATE devices SET content_version = content_version + 1 WHERE organization_id = OLD.organization_id;
        ELSE
            UPDATE devices SET content_version = content_version + 1 WHERE organization_id = NEW.organization_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'campaigns' THEN
        -- campaigns table doesn't have organization_id directly, need to look up via campaign_targets
        IF TG_OP = 'DELETE' THEN
            -- Find devices linked to this campaign and bump them
            UPDATE devices SET content_version = content_version + 1
            WHERE id IN (
                SELECT DISTINCT device_id FROM (
                    SELECT ct.target_id AS device_id
                    FROM campaign_targets ct
                    WHERE ct.campaign_id = OLD.id AND ct.target_type = 'device'
                    UNION
                    SELECT d.id
                    FROM devices d
                    JOIN campaign_playlists cp ON cp.playlist_id = d.campaign_id
                    WHERE cp.campaign_id = OLD.id
                ) x
            );
        ELSE
            UPDATE devices SET content_version = content_version + 1
            WHERE id IN (
                SELECT DISTINCT device_id FROM (
                    SELECT ct.target_id AS device_id
                    FROM campaign_targets ct
                    WHERE ct.campaign_id = NEW.id AND ct.target_type = 'device'
                    UNION
                    SELECT d.id
                    FROM devices d
                    WHERE d.campaign_id = NEW.id
                ) x
            );
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- The trigger on playlists that calls this function is still attached and will now work correctly.
