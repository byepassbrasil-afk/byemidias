CREATE OR REPLACE FUNCTION public.bump_device_content_version()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
    org_id uuid;
    ref_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'playlist_items' OR TG_TABLE_NAME = 'playlists' THEN
        IF TG_OP = 'DELETE' THEN
            ref_id := OLD.playlist_id;
        ELSE
            ref_id := NEW.playlist_id;
        END IF;
        org_id := (SELECT organization_id FROM playlists WHERE id = ref_id);
        UPDATE devices SET content_version = content_version + 1 WHERE organization_id = org_id;
    ELSIF TG_TABLE_NAME = 'media' THEN
        IF TG_OP = 'DELETE' THEN
            UPDATE devices SET content_version = content_version + 1 WHERE organization_id = OLD.organization_id;
        ELSE
            UPDATE devices SET content_version = content_version + 1 WHERE organization_id = NEW.organization_id;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
