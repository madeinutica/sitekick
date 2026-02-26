-- Add is_archived column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Create an index for performance when filtering active jobs
CREATE INDEX IF NOT EXISTS idx_jobs_is_archived ON jobs(is_archived) WHERE is_archived = false;

-- Add comment explaining the field
COMMENT ON COLUMN jobs.is_archived IS 'Flag for soft-deleting old jobs while preserving their photo history.';
