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

-- Separate policies to avoid recursion
CREATE POLICY "Super admins can view all user roles" ON user_roles
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage user roles" ON user_roles
  FOR ALL USING (is_super_admin(auth.uid()));