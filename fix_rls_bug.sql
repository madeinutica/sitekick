-- ─── Fix Multi-Tenancy RLS Bug ───────────────────

-- 1. Drop old policies to replace them
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
DROP POLICY IF EXISTS "Job photos are viewable based on company roles" ON job_photos;
DROP POLICY IF EXISTS "Notes are viewable based on company roles" ON notes;

-- 2. Corrected jobs RLS
CREATE POLICY "Jobs are viewable based on company roles" ON jobs
  FOR SELECT USING (
    -- Super Admin: All jobs
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id -- FIXED: was ur.id
      WHERE p.id = auth.uid() 
      AND (
        -- Global Admin/Ambassador: All jobs
        r.permissions->'jobs'->>'read' = 'all'
        -- Company Admin: All jobs in their company
        OR (r.permissions->'jobs'->>'read' = 'company' AND p.company_id = jobs.company_id)
        -- Rep/User: Only jobs in their company they own or are assigned to
        OR (
          r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
          AND p.company_id = jobs.company_id
          AND (
            jobs.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM project_user_roles pur WHERE pur.project_id = jobs.id AND pur.user_id = auth.uid())
          )
        )
      )
    )
    -- Fallback: If no specific role is found, check if they are the owner and in the same company
    OR (
      user_id = auth.uid() 
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = jobs.company_id)
    )
  );

-- 3. Corrected job_photos RLS
CREATE POLICY "Job photos are viewable based on company roles" ON job_photos
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id -- FIXED: was ur.id
      WHERE j.id = job_photos.job_id
      AND p.company_id = j.company_id
      AND (
        r.permissions->'jobs'->>'read' IN ('all', 'company')
        OR (
          r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
          AND (
            j.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
  );

-- 4. Corrected notes RLS
CREATE POLICY "Notes are viewable based on company roles" ON notes
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id -- FIXED: was ur.id
      WHERE j.id = notes.job_id
      AND p.company_id = j.company_id
      AND (
        r.permissions->'jobs'->>'read' IN ('all', 'company')
        OR (
          r.permissions->'jobs'->>'read' IN ('assigned', 'assigned_or_created')
          AND (
            j.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
          )
        )
      )
    )
  );
