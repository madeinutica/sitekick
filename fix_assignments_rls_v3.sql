-- v3: Consolidated and simplified RLS for job assignments
-- Addressing the "empty error object" which might be a runtime failure in a trigger or policy

-- 1. Robust Admin Check (SECURITY DEFINER bypasses RLS on user_roles/roles)
CREATE OR REPLACE FUNCTION is_any_admin(u_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 
    AND r.name IN ('super_admin', 'company_admin', 'brand_ambassador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Robust Company Sync (SECURITY DEFINER bypasses RLS on jobs)
CREATE OR REPLACE FUNCTION sync_company_id_from_job()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Only look up if not provided
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM jobs
    WHERE id = NEW.job_id;
    
    NEW.company_id := v_company_id;
  END IF;
  
  -- Fallback: if still null, try to get it from the user's profile
  -- (This ensures the row isn't rejected by partitioning policies if the job lookup failed)
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM profiles WHERE id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clear and Re-apply Consolidated Policies
-- First, drop EVERY possible previous policy to start clean
DROP POLICY IF EXISTS "Users can view assignments they have access to" ON job_assignments;
DROP POLICY IF EXISTS "Authorized users can manage assignments" ON job_assignments;
DROP POLICY IF EXISTS "Assignments strictly partitioned by company" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_visibility" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_management" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_partition" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_admin_all" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_self_read" ON job_assignments;

-- Admin Management Policy: Allows full access if you are an admin in the SAME company (or super admin)
CREATE POLICY "job_assignments_admin_policy" ON job_assignments
  FOR ALL USING (
    is_super_admin(auth.uid())
    OR (
      is_any_admin(auth.uid()) 
      AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      is_any_admin(auth.uid()) 
      AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Self Visibility Policy: Users can always see their own assignments
CREATE POLICY "job_assignments_self_visibility" ON job_assignments
  FOR SELECT USING (user_id = auth.uid());
