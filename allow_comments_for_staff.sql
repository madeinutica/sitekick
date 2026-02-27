-- Migration to allow assigned staff to view and add comments
-- This expands visibility and insertion to users in the job_assignments table

-- 1. DROP old policies
DROP POLICY IF EXISTS "Notes are viewable based on roles" ON notes;
DROP POLICY IF EXISTS "Users can insert notes on accessible jobs" ON notes;
DROP POLICY IF EXISTS "Users can update notes on accessible jobs" ON notes;
DROP POLICY IF EXISTS "Users can delete notes on accessible jobs" ON notes;

-- 2. New SELECT policy: accessible if you own the job, are an admin, or are assigned to it
CREATE POLICY "notes_select_policy" ON notes
  FOR SELECT USING (
    auth.uid() = user_id -- Own the note
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        j.user_id = auth.uid() -- Own the job
        OR is_any_admin(auth.uid()) -- Is an admin
        OR EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = j.id AND ja.user_id = auth.uid()
        )
      )
    )
  );

-- 3. New INSERT policy: can insert if you own the job, are an admin, or are assigned to it
CREATE POLICY "notes_insert_policy" ON notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = notes.job_id
      AND (
        j.user_id = auth.uid() -- Own the job
        OR is_any_admin(auth.uid()) -- Is an admin
        OR EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = j.id AND ja.user_id = auth.uid()
        )
      )
    )
  );

-- 4. New UPDATE policy: only the author or super admin can update
CREATE POLICY "notes_update_policy" ON notes
  FOR UPDATE USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

-- 5. New DELETE policy: only the author or super admin can delete
CREATE POLICY "notes_delete_policy" ON notes
  FOR DELETE USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );
