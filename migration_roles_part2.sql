-- Part 2: Policies for role tables
-- RLS Policies for roles table (only super admins can manage roles)
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON roles;
CREATE POLICY "Roles are viewable by authenticated users" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only super admins can manage roles" ON roles;
CREATE POLICY "Only super admins can manage roles" ON roles
  FOR ALL USING (
    is_super_admin(auth.uid())
  );

-- Create a security definer function to check super_admin status
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can view all user roles" ON user_roles;
CREATE POLICY "Super admins can view all user roles" ON user_roles
  FOR SELECT USING (
    is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage user roles" ON user_roles;
CREATE POLICY "Super admins can manage user roles" ON user_roles
  FOR ALL USING (
    is_super_admin(auth.uid())
  );

-- RLS Policies for project_user_roles table
DROP POLICY IF EXISTS "Users can view project roles they have access to" ON project_user_roles;
CREATE POLICY "Users can view project roles they have access to" ON project_user_roles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'brand_ambassador'
    )
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authorized users can assign project roles" ON project_user_roles;
CREATE POLICY "Authorized users can assign project roles" ON project_user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'brand_ambassador'
    )
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    )
  );