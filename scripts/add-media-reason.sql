-- Add reason field for "keep forever" uploads
ALTER TABLE media ADD COLUMN IF NOT EXISTS expires_reason TEXT;
