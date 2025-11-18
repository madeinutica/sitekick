-- Part 3: Jobs policies
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;
CREATE POLICY "Jobs are viewable based on roles" ON jobs
  FOR SELECT USING (
    -- User owns the job
    auth.uid() = user_id
    -- OR user is super_admin
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
    -- OR user has global role that allows reading all jobs
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.permissions->'jobs'->>'read' = 'all'
    )
    -- OR user is assigned to this job
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Jobs are updatable by authorized users" ON jobs;
CREATE POLICY "Jobs are updatable by authorized users" ON jobs
  FOR UPDATE USING (
    -- User owns the job
    auth.uid() = user_id
    -- OR user is super_admin
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
    -- OR user has global role that allows writing to all jobs
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.permissions->'jobs'->>'write' = 'all'
    )
  );