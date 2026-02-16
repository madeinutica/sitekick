-- ─── Refined Multi-Tenancy Gallery & Job Access ───────────────────

-- 1. Redefine Jobs RLS
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
CREATE POLICY "Jobs are viewable based on company roles" ON jobs
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE p.id = auth.uid() 
      AND (
        -- Global Admin roles
        r.name IN ('super_admin', 'brand_ambassador')
        -- Company Admin: See all company jobs
        OR (r.name = 'company_admin' AND p.company_id = jobs.company_id)
        -- Rep/Tech: ONLY jobs they created OR are explicitly assigned to
        OR (
          r.name IN ('rep', 'measure_tech', 'installer')
          AND (
            jobs.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
    OR user_id = auth.uid()
  );

-- 2. Redefine Job Photos RLS
DROP POLICY IF EXISTS "Job photos are viewable based on company roles" ON job_photos;
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
        -- Global & Company Admins: All company photos
        r.name IN ('super_admin', 'brand_ambassador')
        OR (r.name = 'company_admin' AND p.company_id = j.company_id)
        -- Rep/Tech: ONLY photos from jobs they own or are assigned to
        OR (
          r.name IN ('rep', 'measure_tech', 'installer')
          AND (
            j.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
    OR user_id = auth.uid()
  );

-- 3. Redefine Notes RLS
DROP POLICY IF EXISTS "Notes are viewable based on company roles" ON notes;
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
        -- Global & Company Admins: All company notes
        r.name IN ('super_admin', 'brand_ambassador')
        OR (r.name = 'company_admin' AND p.company_id = j.company_id)
        -- Rep/Tech: ONLY notes from jobs they own or are assigned to
        OR (
          r.name IN ('rep', 'measure_tech', 'installer')
          AND (
            j.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
    OR user_id = auth.uid()
  );
