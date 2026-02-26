-- ─── COMPREHENSIVE VISIBILITY ENFORCEMENT ───────────────────

-- 1. CLEANUP: Drop every known historical policy on affected tables
-- JOBS
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
DROP POLICY IF EXISTS "Jobs strictly partitioned by company" ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable by company members" ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable by the user who created them." ON jobs;
DROP POLICY IF EXISTS "Jobs can be updated by company members" ON jobs;
DROP POLICY IF EXISTS "Jobs can be deleted by company members" ON jobs;
DROP POLICY IF EXISTS "Only admins can create jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can manage company jobs" ON jobs;
DROP POLICY IF EXISTS "Jobs visibility" ON jobs;
DROP POLICY IF EXISTS "Jobs are updatable by authorized users" ON jobs;
DROP POLICY IF EXISTS "Jobs are deletable by super admins" ON jobs;
DROP POLICY IF EXISTS "Jobs are insertable by authorized users" ON jobs;

-- JOB PHOTOS
DROP POLICY IF EXISTS "Job photos are viewable based on company roles" ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable based on roles" ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable by company members" ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable by user or super user." ON job_photos;
DROP POLICY IF EXISTS "Job photos are viewable by the user who created them." ON job_photos;
DROP POLICY IF EXISTS "Photos strictly partitioned by company" ON job_photos;
DROP POLICY IF EXISTS "Job photos visibility" ON job_photos;

-- NOTES
DROP POLICY IF EXISTS "Notes are viewable based on company roles" ON notes;
DROP POLICY IF EXISTS "Notes are viewable based on roles" ON notes;
DROP POLICY IF EXISTS "Notes are viewable by company members" ON notes;
DROP POLICY IF EXISTS "Notes are viewable by the user who created them." ON notes;
DROP POLICY IF EXISTS "Notes strictly partitioned by company" ON notes;
DROP POLICY IF EXISTS "Notes visibility" ON notes;
DROP POLICY IF EXISTS "Users can insert notes on accessible jobs" ON notes;
DROP POLICY IF EXISTS "Users can update notes on accessible jobs" ON notes;
DROP POLICY IF EXISTS "Users can delete notes on accessible jobs" ON notes;

-- 2. APPLY NEW STRICT POLICIES

-- JOBS: Strictly assigned or owned for Rep/Tech. Full company for Admins.
CREATE POLICY "Jobs visibility" ON jobs
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
    AND (
      -- Global Admins
      r.name IN ('super_admin', 'brand_ambassador')
      -- Company Admins see all company jobs
      OR (r.name = 'company_admin' AND p.company_id = jobs.company_id)
      -- Reps and Techs ONLY see jobs they are assigned to or created
      OR (
        r.name IN ('rep', 'tech')
        AND (
          jobs.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid())
        )
      )
    )
  )
);

-- JOB PHOTOS: Full company for Admin/Rep. Assigned only for Tech.
CREATE POLICY "Job photos visibility" ON job_photos
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
    AND (
      -- Admins and Brand Ambassadors
      r.name IN ('super_admin', 'brand_ambassador')
      -- Company Admins AND Reps see all company photos
      OR (r.name IN ('company_admin', 'rep') AND p.company_id = job_photos.company_id)
      -- Techs ONLY see photos for jobs they are assigned to or created
      OR (
        r.name = 'tech'
        AND EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = job_photos.job_id
          AND (j.user_id = auth.uid() OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid()))
        )
      )
    )
  )
);

-- NOTES: Aligned with Job visibility
CREATE POLICY "Notes visibility" ON notes
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
    AND (
      -- Global Admins
      r.name IN ('super_admin', 'brand_ambassador')
      -- Company Admins see all company notes
      OR (r.name = 'company_admin' AND p.company_id = notes.company_id)
      -- Reps and Techs ONLY see notes for jobs they are assigned to or created
      OR (
        r.name IN ('rep', 'tech')
        AND EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = notes.job_id
          AND (j.user_id = auth.uid() OR EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid()))
        )
      )
    )
  )
);
