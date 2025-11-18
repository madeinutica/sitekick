-- Combined fix for RLS recursion and jobs policy
-- First, fix the recursion issue with security definer function

-- Fix infinite recursion in user_roles RLS policies
-- Create a security definer function to check super admin status without triggering RLS
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  -- Disable RLS for this query to avoid recursion
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the problematic policy that causes circular dependency
DROP POLICY IF EXISTS "Super admins can view all user roles" ON user_roles;

-- Drop any existing manage policies
DROP POLICY IF EXISTS "Super admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage all user roles" ON user_roles;

-- Keep only the policy that allows users to see their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Also allow super admins to manage all user roles (for INSERT/UPDATE/DELETE)
CREATE POLICY "Super admins can manage all user roles" ON user_roles
  FOR ALL USING (is_super_admin(auth.uid()));

-- Now fix the jobs table RLS policy
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
    )) OR
    (EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN project_user_roles pur ON pur.user_id = auth.uid()
      WHERE ur.user_id = auth.uid() AND pur.project_id = jobs.id AND
            ((r.permissions -> 'jobs'::text) ->> 'read'::text) = 'assigned_or_created'::text
    ))
  );