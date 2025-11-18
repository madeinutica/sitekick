-- Part 4: Update job_photos RLS to use new role system
DROP POLICY IF EXISTS "Job photos are viewable by user or super user." ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable based on roles" ON job_photos;
CREATE POLICY "Job photos are viewable based on roles" ON job_photos
FOR SELECT USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.permissions->'photos'->>'read' = 'all'
  )
  OR EXISTS (
    SELECT 1 FROM project_user_roles pur
    JOIN roles r ON pur.role_id = r.id
    JOIN jobs j ON pur.project_id = j.id
    WHERE pur.user_id = auth.uid() AND j.id = job_photos.job_id
    AND r.permissions->'photos'->>'read' = 'assigned'
  )
);