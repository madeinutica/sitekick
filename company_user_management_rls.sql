-- ─── DECENTRALIZED USER MANAGEMENT ENFORCEMENT ───────────────────

-- 1. Helper Function: Check if user is a Company Admin
-- (Using SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION is_company_admin(u_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 AND r.name = 'company_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper Function: Get user's company ID safely
CREATE OR REPLACE FUNCTION get_user_company_id(u_id UUID) RETURNS UUID AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN (SELECT company_id FROM profiles WHERE id = $1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update User Roles Policy
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Super admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Company admins can manage roles for their users" ON user_roles;

-- PLATFORM POLICY: Super Admins can manage all user roles
CREATE POLICY "Super admins can manage all user roles" ON user_roles
  FOR ALL USING (is_super_admin(auth.uid()));

-- COMPANY POLICY: Company Admins can manage roles for their company members
-- Restrictions:
-- - Can only manage users in their own company.
-- - Cannot view or manage Super Admin users.
-- - Cannot assign or remove platform-level roles (super_admin, brand_ambassador).
CREATE POLICY "Company admins can manage roles for their users" ON user_roles
  FOR ALL USING (
    is_company_admin(auth.uid()) 
    AND get_user_company_id(user_id) = get_user_company_id(auth.uid())
    AND NOT is_super_admin(user_id)
    AND EXISTS (
      SELECT 1 FROM roles r 
      WHERE r.id = role_id 
      AND r.name NOT IN ('super_admin', 'brand_ambassador')
    )
  );

-- 4. Ensure Company Admins can view roles for selection
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON roles;
CREATE POLICY "Roles are viewable by authenticated users" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');
