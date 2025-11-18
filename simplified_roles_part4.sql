-- Part 4: Job photos policies
DROP POLICY IF EXISTS "Job photos are viewable based on roles" ON job_photos;
CREATE POLICY "Job photos are viewable based on roles" ON job_photos
  FOR SELECT USING (
    -- User owns the photo
    auth.uid() = user_id
    -- OR user is super_admin
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
    -- OR user is brand_ambassador (can see all photos)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'brand_ambassador'
    )
    -- OR user is rep (can see all photos)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'rep'
    )
    -- OR user has access to the job the photo belongs to
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_photos.job_id
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