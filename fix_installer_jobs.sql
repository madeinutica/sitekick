-- Fix for installer role job visibility issue
-- Run this SQL in your Supabase SQL editor or database console

-- Drop the existing policy
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;

-- Create the corrected policy that includes global roles with 'assigned_or_created' permissions
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
    -- OR user has global role with 'assigned_or_created' permissions AND is assigned to this job
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN project_user_roles pur ON pur.user_id = auth.uid()
      WHERE ur.user_id = auth.uid() AND pur.project_id = jobs.id
      AND r.permissions->'jobs'->>'read' = 'assigned_or_created'
    )
    OR is_super_admin(auth.uid())
  );