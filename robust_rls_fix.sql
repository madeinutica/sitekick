-- ─── Robust Multi-Tenancy RLS ───────────────────

-- 1. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
DROP POLICY IF EXISTS "Job photos are viewable based on company roles" ON job_photos;
DROP POLICY IF EXISTS "Notes are viewable based on company roles" ON notes;

-- 2. Improved Jobs RLS
CREATE POLICY "Jobs are viewable based on company roles" ON jobs
  FOR SELECT USING (
    -- Super Admin: Always see everything
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE p.id = auth.uid() 
      AND (
        -- Global Admin roles
        r.name IN ('super_admin', 'brand_ambassador')
        -- Company Admin: See all company jobs OR jobs they created (even if no company assigned yet)
        OR (r.name = 'company_admin' AND (p.company_id = jobs.company_id OR jobs.user_id = auth.uid()))
        -- Rep/Tech: See jobs they created OR are assigned to (company match not strictly required for direct assignments)
        OR (
          r.name IN ('rep', 'measure_tech', 'installer')
          AND (
            jobs.user_id = auth.uid()
            OR (p.company_id IS NOT NULL AND p.company_id = jobs.company_id)
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
          )
        )
        -- Fallback: Same company
        OR (p.company_id IS NOT NULL AND p.company_id = jobs.company_id)
      )
    )
    -- Direct ownership fallback
    OR user_id = auth.uid()
  );

-- 3. Improved Job Photos RLS
CREATE POLICY "Job photos are viewable based on company roles" ON job_photos
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE j.id = job_photos.job_id
      AND (
        r.name IN ('super_admin', 'brand_ambassador', 'company_admin')
        OR j.user_id = auth.uid()
        OR (p.company_id IS NOT NULL AND p.company_id = j.company_id)
        OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
      )
    )
  );

-- 4. Improved Notes RLS
CREATE POLICY "Notes are viewable based on company roles" ON notes
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE j.id = notes.job_id
      AND (
        r.name IN ('super_admin', 'brand_ambassador', 'company_admin')
        OR j.user_id = auth.uid()
        OR (p.company_id IS NOT NULL AND p.company_id = j.company_id)
        OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
      )
    )
  );
