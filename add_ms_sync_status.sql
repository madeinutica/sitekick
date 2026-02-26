-- Add sync status columns to job_photos
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS ms_sync_status text DEFAULT 'pending' CHECK (ms_sync_status IN ('pending', 'synced', 'failed', 'ignored'));
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS ms_sync_at timestamp with time zone;

-- Index for easier tracking
CREATE INDEX IF NOT EXISTS idx_job_photos_ms_sync_status ON job_photos(ms_sync_status);
