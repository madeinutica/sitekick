DROP POLICY IF EXISTS "Users can delete notes on jobs they can access." ON notes;
DROP POLICY IF EXISTS "Users can delete notes on accessible jobs" ON notes;
-- Create a security definer function to check super_admin status
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can delete notes on accessible jobs" ON notes
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        j.user_id = auth.uid()
        OR is_super_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.permissions->'jobs'->>'write' = 'all'
        )
        OR EXISTS (
          SELECT 1 FROM project_user_roles pur
          JOIN roles r ON pur.role_id = r.id
          WHERE pur.user_id = auth.uid() AND pur.project_id = j.id
          AND r.permissions->'jobs'->>'write' IN ('assigned', 'assigned_or_created')
        )
      )
    )
  );