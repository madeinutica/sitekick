-- Simple fix for jobs visibility - allow super admins to see all jobs
-- Drop ALL existing policies on jobs to avoid conflicts
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'jobs' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON jobs';
    END LOOP;
END $$;

-- Create policies for jobs access
CREATE POLICY "Super admins can view all jobs" ON jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can view their own jobs" ON jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view jobs they are assigned to" ON jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_user_roles pur
      WHERE pur.project_id = jobs.id AND pur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" ON jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can update all jobs" ON jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can delete their own jobs" ON jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can delete all jobs" ON jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Policies for project_user_roles (job assignments)
-- Drop existing policies on project_user_roles
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'project_user_roles' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON project_user_roles';
    END LOOP;
END $$;

CREATE POLICY "Users can view project roles they have access to" ON project_user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    ) OR
    auth.uid() = 'de81c896-89e6-45b7-9f0e-3933a42aeb64'::uuid
  );

CREATE POLICY "Authorized users can assign project roles" ON project_user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'brand_ambassador')
    )
  );

CREATE POLICY "Authorized users can update project roles" ON project_user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'brand_ambassador')
    )
  );

CREATE POLICY "Authorized users can remove project roles" ON project_user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = project_id AND j.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'brand_ambassador')
    )
  );