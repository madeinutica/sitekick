-- Part 5: Update notes RLS to use new role system
DROP POLICY IF EXISTS "Notes are viewable by users who can access the job." ON notes;
DROP POLICY IF EXISTS "Notes are viewable based on roles" ON notes;
CREATE POLICY "Notes are viewable based on roles" ON notes
  FOR SELECT USING (
    -- User owns the note
    auth.uid() = user_id
    -- OR user has access to the job the note belongs to
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        -- User owns the job
        j.user_id = auth.uid()
        -- OR user has global role that allows reading all jobs
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.permissions->'jobs'->>'read' = 'all'
        )
        OR is_super_admin(auth.uid())
        -- OR user has project-specific role for this job
        OR EXISTS (
          SELECT 1 FROM project_user_roles pur
          JOIN roles r ON pur.role_id = r.id
          WHERE pur.user_id = auth.uid() AND pur.project_id = j.id
          AND r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
        )
        OR is_super_admin(auth.uid())
      )
    )
  );