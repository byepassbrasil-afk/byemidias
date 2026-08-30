-- Partner notifications table
CREATE TABLE IF NOT EXISTS partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_access_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_notif_partner ON partner_notifications(partner_access_id, read);
CREATE INDEX IF NOT EXISTS idx_partner_notif_created ON partner_notifications(created_at DESC);

-- Add rejection_reason to partner_media_uploads
ALTER TABLE partner_media_uploads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE partner_media_uploads ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE partner_media_uploads ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);
