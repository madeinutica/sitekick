-- ─── REFINE REP GALLERY VISIBILITY ───────────────────
-- Relax the Jobs RLS for Sales Reps to allow joined queries 
-- (like the Gallery) to return job names for all company projects.

DROP POLICY IF EXISTS "Jobs visibility" ON jobs;

CREATE POLICY "Jobs visibility" ON jobs
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
    AND (
      -- Global Admins (Super Admins, Brand Ambassadors)
      r.name IN ('super_admin', 'brand_ambassador')
      -- Company Admins see all company jobs
      OR (r.name = 'company_admin' AND p.company_id = jobs.company_id)
      -- NEW: Sales Reps see ALL company jobs so gallery joins work 
      -- (Notes and documents are still strictly filtered by assignment)
      OR (r.name = 'rep' AND p.company_id = jobs.company_id)
      -- Techs ONLY see jobs they are assigned to or created
      OR (
        r.name = 'tech'
        AND (
          jobs.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
        )
      )
    )
  )
);

COMMENT ON POLICY "Jobs visibility" ON jobs IS 'Allows Admins/Reps full company job visibility for context; Techs limited to assigned jobs.';
