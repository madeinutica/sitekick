-- Part 5: Notes policies
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
        -- OR user has global role with 'assigned' permissions AND is assigned to this job
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN job_assignments ja ON ja.user_id = auth.uid()
          WHERE ur.user_id = auth.uid() AND ja.job_id = j.id
          AND r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
        )
      )
    )
  );

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
        -- OR user has global role with 'assigned' permissions AND is assigned to this job
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN job_assignments ja ON ja.user_id = auth.uid()
          WHERE ur.user_id = auth.uid() AND ja.job_id = j.id
          AND r.permissions->'jobs'->>'write' IN ('assigned', 'assigned_or_created')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update notes on accessible jobs" ON notes;
CREATE POLICY "Users can update notes on accessible jobs" ON notes
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        -- User owns the job
        j.user_id = auth.uid()
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
        -- OR user has global role with 'assigned' permissions AND is assigned to this job
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN job_assignments ja ON ja.user_id = auth.uid()
          WHERE ur.user_id = auth.uid() AND ja.job_id = j.id
          AND r.permissions->'jobs'->>'write' IN ('assigned', 'assigned_or_created')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete notes on accessible jobs" ON notes;
CREATE POLICY "Users can delete notes on accessible jobs" ON notes
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        -- User owns the job
        j.user_id = auth.uid()
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
        -- OR user has global role with 'assigned' permissions AND is assigned to this job
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN job_assignments ja ON ja.user_id = auth.uid()
          WHERE ur.user_id = auth.uid() AND ja.job_id = j.id
          AND r.permissions->'jobs'->>'write' IN ('assigned', 'assigned_or_created')
        )
      )
    )
  );