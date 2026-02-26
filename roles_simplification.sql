-- ─── 1. Consolidate and Update Roles ───────────────────

-- Ensure generic roles exist with correct names and descriptions
-- Note: Permissions JSON structure can be expanded later
INSERT INTO roles (name, description, permissions) VALUES
  ('super_admin', 'Global platform access with full visibility.', '{"all": true}'),
  ('company_admin', 'Full access to company data and user management. Can create jobs.', '{"jobs": {"read": "company", "write": "company", "create": true}, "photos": {"read": "company", "write": "company"}}'),
  ('rep', 'Sales and project management. Access to assigned jobs.', '{"jobs": {"read": "assigned", "write": "assigned", "create": false}, "photos": {"read": "assigned", "write": "assigned"}}'),
  ('tech', 'Field operations. Access to assigned jobs and photo uploads.', '{"jobs": {"read": "assigned", "write": "assigned", "create": false}, "photos": {"read": "assigned", "write": "assigned"}}')
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- ─── 2. Migrate Legacy Roles to Generic 'tech' Role ───

DO $$
DECLARE
  v_tech_role_id BIGINT;
  v_measure_tech_id BIGINT;
  v_installer_id BIGINT;
BEGIN
  SELECT id INTO v_tech_role_id FROM roles WHERE name = 'tech';
  SELECT id INTO v_measure_tech_id FROM roles WHERE name = 'measure_tech';
  SELECT id INTO v_installer_id FROM roles WHERE name = 'installer';

  -- Move measure_tech users to tech
  IF v_measure_tech_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT user_id, v_tech_role_id FROM user_roles WHERE role_id = v_measure_tech_id
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    DELETE FROM user_roles WHERE role_id = v_measure_tech_id;
  END IF;

  -- Move installer users to tech
  IF v_installer_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT user_id, v_tech_role_id FROM user_roles WHERE role_id = v_installer_id
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    DELETE FROM user_roles WHERE role_id = v_installer_id;
  END IF;

  -- Clean up old role definitions
  DELETE FROM roles WHERE name IN ('measure_tech', 'installer');
END $$;

-- ─── 3. Update RLS Policies for Strict Partitioning & Job Creation ───────────────────

-- JOBS: Strictly partitioning and restricting INSERT to company_admin/super_admin
DROP POLICY IF EXISTS "Jobs strictly partitioned by company" ON jobs;
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;

-- Select Policy
CREATE POLICY "Jobs strictly partitioned by company" ON jobs
  FOR SELECT USING (
    (company_id = get_my_company_id())
    OR is_super_admin(auth.uid())
  );

-- Insert Policy (Restrict to company_admin and super_admin)
CREATE POLICY "Only admins can create jobs" ON jobs
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('company_admin', 'super_admin')
      )
      AND company_id = get_my_company_id()
    )
    OR is_super_admin(auth.uid())
  );

-- Update/Delete Policy
CREATE POLICY "Admins can manage company jobs" ON jobs
  FOR ALL USING (
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('company_admin', 'super_admin')
      )
      AND company_id = get_my_company_id()
    )
    OR is_super_admin(auth.uid())
  );

-- PHOTOS (Already partitioned in previous step, but ensuring triggers are solid)
-- (No changes needed here if strict_multi_tenancy_and_backfill.sql was run, 
-- but we unify naming)
DROP POLICY IF EXISTS "Photos strictly partitioned by company" ON job_photos;
CREATE POLICY "Photos strictly partitioned by company" ON job_photos
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );

-- NOTES
DROP POLICY IF EXISTS "Notes strictly partitioned by company" ON notes;
CREATE POLICY "Notes strictly partitioned by company" ON notes
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );
