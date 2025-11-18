-- Part 2: Job assignments policies
DROP POLICY IF EXISTS "Users can view assignments they have access to" ON job_assignments;
CREATE POLICY "Users can view assignments they have access to" ON job_assignments
  FOR SELECT USING (
    -- User is assigned to this job
    user_id = auth.uid()
    -- OR user is super_admin
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Authorized users can manage assignments" ON job_assignments;
CREATE POLICY "Authorized users can manage assignments" ON job_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );