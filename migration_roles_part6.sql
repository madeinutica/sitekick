-- Part 6: Update notes INSERT policy
DROP POLICY IF EXISTS "Users can insert notes on jobs they can access." ON notes;
DROP POLICY IF EXISTS "Users can insert notes on accessible jobs" ON notes;
CREATE POLICY "Users can insert notes on accessible jobs" ON notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        -- User owns the job
        j.user_id = auth.uid()
        -- OR user has global role that allows writing to all jobs
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.permissions->'jobs'->>'write' = 'all'
        )
        OR is_super_admin(auth.uid())
        -- OR user has project-specific role for this job
        OR EXISTS (
          SELECT 1 FROM project_user_roles pur
          JOIN roles r ON pur.role_id = r.id
          WHERE pur.user_id = auth.uid() AND pur.project_id = j.id
          AND r.permissions->'jobs'->>'write' IN ('assigned', 'assigned_or_created')
        )
        OR is_super_admin(auth.uid())
      )
    )
  );