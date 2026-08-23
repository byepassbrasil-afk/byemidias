-- Auto-deactivate expired campaigns
CREATE OR REPLACE FUNCTION deactivate_expired_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE campaigns
    SET status = 'ended', updated_at = NOW()
    WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;
END;
$function$;

-- Get active playlist for a device based on time slots
CREATE OR REPLACE FUNCTION get_active_playlist_for_device(p_device_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_campaign_id uuid;
    v_now_dow integer;
    v_now_time time;
    v_slot_playlist_id uuid;
    v_default_playlist_id uuid;
BEGIN
    -- Get device's campaign
    SELECT campaign_id INTO v_campaign_id
    FROM devices WHERE id = p_device_id;

    IF v_campaign_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get current day of week (0=Sunday in JS, but we use 0=Monday)
    v_now_dow := EXTRACT(DOW FROM NOW())::integer;
    -- Convert: PostgreSQL DOW: 0=Sun,1=Mon...6=Sat -> We want 0=Mon...6=Sun
    v_now_dow := CASE WHEN v_now_dow = 0 THEN 6 ELSE v_now_dow - 1 END;
    v_now_time := CURRENT_TIME;

    -- Find a matching time slot
    SELECT playlist_id INTO v_slot_playlist_id
    FROM campaign_time_slots
    WHERE campaign_id = v_campaign_id
    AND day_of_week = v_now_dow
    AND start_time <= v_now_time
    AND end_time > v_now_time
    AND status = 'active'
    ORDER BY priority DESC
    LIMIT 1;

    IF v_slot_playlist_id IS NOT NULL THEN
        RETURN v_slot_playlist_id;
    END IF;

    -- No time slot matched, get the default playlist from campaign_playlists (position 0)
    SELECT cp.playlist_id INTO v_default_playlist_id
    FROM campaign_playlists cp
    WHERE cp.campaign_id = v_campaign_id
    ORDER BY cp.position ASC
    LIMIT 1;

    RETURN v_default_playlist_id;
END;
$function$;
