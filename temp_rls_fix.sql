-- Temporarily modify RLS policy for debugging
-- This allows all authenticated users to see user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.role() = 'authenticated');