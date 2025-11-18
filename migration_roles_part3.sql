-- Part 3: Update jobs RLS to use new role system
DROP POLICY IF EXISTS "Jobs are viewable by user or super user." ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;
CREATE POLICY "Jobs are viewable based on roles" ON jobs
  FOR SELECT USING (
    -- User owns the job
    auth.uid() = user_id
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
      WHERE pur.user_id = auth.uid() AND pur.project_id = jobs.id
      AND r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
    )
    OR is_super_admin(auth.uid())
  );