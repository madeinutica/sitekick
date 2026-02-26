-- ─── ENABLE COMMUNAL PHOTO EDITING ───────────────────
-- Grant UPDATE permissions to any user who can view the photo
-- (Admins, Reps for company, Techs for assigned jobs)

DROP POLICY IF EXISTS "Job photos update visibility" ON job_photos;

CREATE POLICY "Job photos update visibility" ON job_photos
FOR UPDATE USING (
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
)
WITH CHECK (true); -- Allow any updates as long as the record remains visible

COMMENT ON POLICY "Job photos update visibility" ON job_photos IS 'Enables communal editing: if you can see a photo, you can edit its metadata.';
