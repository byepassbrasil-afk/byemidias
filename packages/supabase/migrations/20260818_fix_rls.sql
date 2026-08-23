DROP POLICY IF EXISTS "Org members view own campaign_playlists" ON campaign_playlists;
CREATE POLICY "Org members view own campaign_playlists" ON campaign_playlists FOR SELECT USING (true);
