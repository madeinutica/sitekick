-- ─── 1. Ensure 'New York Sash' exists ───
INSERT INTO companies (name)
VALUES ('New York Sash')
ON CONFLICT (name) DO NOTHING;

-- Get the ID for reference in the script
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE name = 'New York Sash';

  -- ─── 2. Add company_id to child tables if missing ───
  
  -- Job Photos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_photos' AND column_name = 'company_id') THEN
    ALTER TABLE job_photos ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;

  -- Notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'company_id') THEN
    ALTER TABLE notes ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;

  -- Job Assignments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_assignments' AND column_name = 'company_id') THEN
    ALTER TABLE job_assignments ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;

  -- Photo Tags
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'photo_tags') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'photo_tags' AND column_name = 'company_id') THEN
      ALTER TABLE photo_tags ADD COLUMN company_id UUID REFERENCES companies(id);
    END IF;
  END IF;

  -- Team Members
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'company_id') THEN
      ALTER TABLE team_members ADD COLUMN company_id UUID REFERENCES companies(id);
    END IF;
  END IF;

  -- ─── 3. Backfill Legacy Data ───

  -- Profiles (Users)
  UPDATE profiles 
  SET company_id = v_company_id 
  WHERE company_id IS NULL;

  -- Ensure users have a base role (rep) if they don't have one
  INSERT INTO user_roles (user_id, role_id)
  SELECT p.id, (SELECT id FROM roles WHERE name = 'rep')
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.company_id = v_company_id
  AND ur.user_id IS NULL
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- Jobs
  UPDATE jobs 
  SET company_id = v_company_id 
  WHERE company_id IS NULL;

  -- Job Photos (Inherit from Job)
  UPDATE job_photos jp
  SET company_id = j.company_id
  FROM jobs j
  WHERE jp.job_id = j.id
  AND jp.company_id IS NULL;

  -- Notes (Inherit from Job)
  UPDATE notes n
  SET company_id = j.company_id
  FROM jobs j
  WHERE n.job_id = j.id
  AND n.company_id IS NULL;

  -- Job Assignments (Inherit from Job)
  UPDATE job_assignments ja
  SET company_id = j.company_id
  FROM jobs j
  WHERE ja.job_id = j.id
  AND ja.company_id IS NULL;

  -- Fallback for any orphaned photos/notes/assignments to target company
  UPDATE job_photos SET company_id = v_company_id WHERE company_id IS NULL;
  UPDATE notes SET company_id = v_company_id WHERE company_id IS NULL;
  UPDATE job_assignments SET company_id = v_company_id WHERE company_id IS NULL;

END $$;

-- ─── 4. Automation Triggers ───

-- Trigger function to auto-assign company_id from parent job
CREATE OR REPLACE FUNCTION sync_company_id_from_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM jobs
    WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to child tables
DROP TRIGGER IF EXISTS sync_company_id_notes ON notes;
CREATE TRIGGER sync_company_id_notes
  BEFORE INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION sync_company_id_from_job();

DROP TRIGGER IF EXISTS sync_company_id_photos ON job_photos;
CREATE TRIGGER sync_company_id_photos
  BEFORE INSERT ON job_photos
  FOR EACH ROW EXECUTE FUNCTION sync_company_id_from_job();

DROP TRIGGER IF EXISTS sync_company_id_assignments ON job_assignments;
CREATE TRIGGER sync_company_id_assignments
  BEFORE INSERT ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_company_id_from_job();

-- ─── 5. Simplified RLS Policies ───

-- Helper function for performance
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- JOBS
DROP POLICY IF EXISTS "Jobs are viewable based on company roles" ON jobs;
DROP POLICY IF EXISTS "Jobs strictly partitioned by company" ON jobs;
CREATE POLICY "Jobs strictly partitioned by company" ON jobs
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );

-- PHOTOS
DROP POLICY IF EXISTS "Job photos are viewable based on company roles" ON job_photos;
DROP POLICY IF EXISTS "Photos strictly partitioned by company" ON job_photos;
CREATE POLICY "Photos strictly partitioned by company" ON job_photos
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );

-- NOTES
DROP POLICY IF EXISTS "Notes are viewable based on company roles" ON notes;
DROP POLICY IF EXISTS "Notes strictly partitioned by company" ON notes;
CREATE POLICY "Notes strictly partitioned by company" ON notes
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );

-- ASSIGNMENTS
DROP POLICY IF EXISTS "Users can view assignments they have access to" ON job_assignments;
DROP POLICY IF EXISTS "Assignments strictly partitioned by company" ON job_assignments;
CREATE POLICY "Assignments strictly partitioned by company" ON job_assignments
  FOR ALL USING (
    company_id = get_my_company_id()
    OR is_super_admin(auth.uid())
  );
