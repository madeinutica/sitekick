-- Complete fix for job deletion issues
-- This ensures all foreign key constraints have CASCADE DELETE
-- and that super admins can delete jobs

-- Add CASCADE DELETE to photo_tags foreign key constraint
ALTER TABLE photo_tags DROP CONSTRAINT IF EXISTS photo_tags_photo_id_fkey;
ALTER TABLE photo_tags ADD CONSTRAINT photo_tags_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES job_photos(id) ON DELETE CASCADE;

-- Ensure all job-related foreign keys have CASCADE DELETE
ALTER TABLE job_assignments DROP CONSTRAINT IF EXISTS job_assignments_job_id_fkey;
ALTER TABLE job_assignments ADD CONSTRAINT job_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE job_photos DROP CONSTRAINT IF EXISTS job_photos_job_id_fkey;
ALTER TABLE job_photos ADD CONSTRAINT job_photos_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_job_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- Ensure the jobs DELETE policy allows super admins
DROP POLICY IF EXISTS "Jobs are deletable by super admins" ON jobs;
CREATE POLICY "Jobs are deletable by super admins" ON jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Verify the setup by checking constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.table_schema
WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'jobs'
ORDER BY tc.table_name;