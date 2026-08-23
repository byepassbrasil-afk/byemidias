-- Add RLS policies for playlist_slots
ALTER TABLE playlist_slots ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on playlist_slots"
    ON playlist_slots FOR ALL
    USING (auth.role() = 'service_role');

-- Allow all operations (admin uses service client, partner routes use service client)
CREATE POLICY "Allow all on playlist_slots"
    ON playlist_slots FOR ALL
    USING (true);
