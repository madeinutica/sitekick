-- Fix the jobs table RLS policy to remove duplicate is_super_admin check and ensure proper access
-- Drop the existing policy that has the duplicate
DROP POLICY IF EXISTS "Users can view jobs based on roles" ON jobs;

-- Create the corrected policy
CREATE POLICY "Users can view jobs based on roles" ON jobs
  FOR SELECT USING (
    (auth.uid() = user_id) OR
    (EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND ((r.permissions -> 'jobs'::text) ->> 'read'::text) = 'all'::text
    )) OR
    is_super_admin(auth.uid()) OR
    (EXISTS (
      SELECT 1 FROM project_user_roles pur
      JOIN roles r ON pur.role_id = r.id
      WHERE pur.user_id = auth.uid() AND pur.project_id = jobs.id AND
            ((r.permissions -> 'jobs'::text) ->> 'read'::text) = ANY (ARRAY['assigned'::text, 'assigned_or_created'::text])
    ))
  );