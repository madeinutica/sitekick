-- Minimal migration to add CASCADE DELETE for job deletion
-- Add CASCADE DELETE to existing foreign key constraints

ALTER TABLE job_assignments DROP CONSTRAINT IF EXISTS job_assignments_job_id_fkey;
ALTER TABLE job_assignments ADD CONSTRAINT job_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE job_photos DROP CONSTRAINT IF EXISTS job_photos_job_id_fkey;
ALTER TABLE job_photos ADD CONSTRAINT job_photos_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_job_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;