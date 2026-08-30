-- Fix FK: related_media_id should be SET NULL on media delete (not NO ACTION)
ALTER TABLE partner_notifications DROP CONSTRAINT IF EXISTS partner_notifications_related_media_id_fkey;
ALTER TABLE partner_notifications ADD CONSTRAINT partner_notifications_related_media_id_fkey
  FOREIGN KEY (related_media_id) REFERENCES media(id) ON DELETE SET NULL;
