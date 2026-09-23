-- Add all APK config fields to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS api_base_url TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS video_player TEXT DEFAULT 'exoplayer' CHECK (video_player IN ('native', 'vlc', 'exoplayer'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS html_render TEXT DEFAULT 'native' CHECK (html_render IN ('native', 'webview'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_fit_mode TEXT DEFAULT 'centerCrop' CHECK (image_fit_mode IN ('fill', 'center', 'centerCrop', 'centerInside', 'fitCenter', 'fit'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_rotation_lock INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS video_volume INTEGER DEFAULT 100 CHECK (video_volume >= 0 AND video_volume <= 100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS auto_update BOOLEAN DEFAULT TRUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS low_mem_restart BOOLEAN DEFAULT TRUE;
