-- ─── Granular Multi-Tenancy RLS ───────────────────

-- 1. Add company_admin role if it doesn't exist
INSERT INTO roles (name, description, permissions) VALUES
  ('company_admin', 'Full access to all company data', '{"jobs": {"read": "company", "write": "company"}, "photos": {"read": "company", "write": "company"}}')
ON CONFLICT (name) DO NOTHING;

-- 2. Update jobs RLS Policies
DROP POLICY IF EXISTS "Jobs are viewable by company members" ON jobs;
DROP POLICY IF EXISTS "Jobs can be updated by company members" ON jobs;
DROP POLICY IF EXISTS "Jobs can be deleted by company members" ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;

CREATE POLICY "Jobs are viewable based on company roles" ON jobs
  FOR SELECT USING (
    -- Super Admin: All jobs
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.id
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

-- 3. Update job_photos RLS
DROP POLICY IF EXISTS "Job photos are viewable by company members" ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable based on roles" ON job_photos;

CREATE POLICY "Job photos are viewable based on company roles" ON job_photos
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.id
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

-- 4. Update notes RLS
DROP POLICY IF EXISTS "Notes are viewable by company members" ON notes;
DROP POLICY IF EXISTS "Notes are viewable based on roles" ON notes;

CREATE POLICY "Notes are viewable based on company roles" ON notes
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.id = auth.uid()
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.id
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
