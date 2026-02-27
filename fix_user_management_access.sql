-- ─── FIX USER MANAGEMENT ACCESS ───────────────────

-- 1. Ensure users can always view their own roles
-- This is critical for frontend authorization checks.
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Data Fix: Assign Erick Florez to 'New York Sash'
-- This ensures he has a valid company context when accessing the dashboard.
DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  -- Get New York Sash ID
  SELECT id INTO v_company_id FROM companies WHERE name = 'New York Sash' LIMIT 1;
  
  -- Get Erick's ID
  SELECT id INTO v_user_id FROM profiles WHERE full_name ILIKE '%Erick Florez%' LIMIT 1;

  IF v_company_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    UPDATE profiles 
    SET company_id = v_company_id 
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Assigned user % to company %', v_user_id, v_company_id;
  END IF;
END $$;

-- 3. Fix broken joins in granular policies (if they exist)
-- Some older policies mistakenly used ur.id instead of ur.role_id
-- We'll re-apply the correct logic for critical visibility policies.

-- FIX: Jobs visibility
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
CREATE POLICY "Jobs are viewable based on company roles" ON jobs
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id -- CORRECTED JOIN
      WHERE p.id = auth.uid() 
      AND (
        r.name IN ('super_admin', 'brand_ambassador')
        OR (r.name = 'company_admin' AND (p.company_id = jobs.company_id OR jobs.user_id = auth.uid()))
        OR (
          r.name IN ('rep', 'tech')
          AND (
            jobs.user_id = auth.uid()
            OR (p.company_id IS NOT NULL AND p.company_id = jobs.company_id)
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
    OR user_id = auth.uid()
  );

-- FIX: User Roles Partitioning (Ensure company admins can manage their own company users)
DROP POLICY IF EXISTS "Company admins can manage roles for their users" ON user_roles;
CREATE POLICY "Company admins can manage roles for their users" ON user_roles
  FOR ALL USING (
    is_company_admin(auth.uid()) 
    AND (
      -- If company admin has a company, manage users in that same company
      (get_user_company_id(user_id) = get_user_company_id(auth.uid()))
      -- OR if it's their own record (allow self-viewing even if company is null)
      OR (auth.uid() = user_id)
    )
    AND NOT is_super_admin(user_id)
    AND EXISTS (
      SELECT 1 FROM roles r 
      WHERE r.id = role_id 
      AND r.name NOT IN ('super_admin', 'brand_ambassador')
    )
  );
