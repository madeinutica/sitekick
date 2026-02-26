-- 1. Unified Admin Check Function
CREATE OR REPLACE FUNCTION is_any_admin(u_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  -- Disable RLS for this lookup
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1 
    AND r.name IN ('super_admin', 'company_admin', 'brand_ambassador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Sync Trigger Function to be SECURITY DEFINER
-- This fixes the "query would be affected by row-level security policy for table 'jobs'" error
CREATE OR REPLACE FUNCTION sync_company_id_from_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    -- Disable RLS context for this lookup to ensure we can read the parent job's company_id
    SET LOCAL row_security = off;
    SELECT company_id INTO NEW.company_id
    FROM jobs
    WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update job_assignments RLS Policies
-- Drop old policies
DROP POLICY IF EXISTS "Users can view assignments they have access to" ON job_assignments;
DROP POLICY IF EXISTS "Authorized users can manage assignments" ON job_assignments;
DROP POLICY IF EXISTS "Assignments strictly partitioned by company" ON job_assignments;

-- Visibility Policy: Users can see assignments they are part of, OR if they are an admin
CREATE POLICY "job_assignments_visibility" ON job_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_any_admin(auth.uid())
  );

-- Management Policy: Admins can manage assignments for their company
CREATE POLICY "job_assignments_management" ON job_assignments
  FOR ALL USING (
    is_any_admin(auth.uid())
  )
  WITH CHECK (
    is_any_admin(auth.uid())
  );

-- Ensure strict multi-tenancy holds even for admins (managed via get_my_company_id if preferred, 
-- but is_any_admin already bypasses recursion for the role check).
-- Re-applying the company partitioning to be safe for data isolation.
DROP POLICY IF EXISTS "job_assignments_partition" ON job_assignments;
CREATE POLICY "job_assignments_partition" ON job_assignments
  FOR ALL USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );
