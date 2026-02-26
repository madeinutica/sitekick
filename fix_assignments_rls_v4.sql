-- v4: Expand SELECT visibility for job assignments
-- Allow any user in the same company to see job assignments
-- This enables technicians (non-admins) to see who else is on their jobs.

DROP POLICY IF EXISTS "job_assignments_self_visibility" ON job_assignments;

CREATE POLICY "job_assignments_company_read_policy" ON job_assignments
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
