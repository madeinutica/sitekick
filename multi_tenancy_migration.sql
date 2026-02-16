-- ─── Multi-Tenancy Migration ───────────────────

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Companies are viewable by authenticated users
CREATE POLICY "Companies are viewable by authenticated users" ON companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Modify profiles to link to companies
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- 3. Modify jobs to link to companies
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- 4. Create trigger function to auto-assign company_id to new jobs
CREATE OR REPLACE FUNCTION public.handle_job_company_assignment()
RETURNS trigger AS $$
BEGIN
  -- Set company_id from the user's profile
  NEW.company_id := (SELECT company_id FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_job_company_assignment ON jobs;
CREATE TRIGGER tr_job_company_assignment
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE PROCEDURE public.handle_job_company_assignment();

-- 5. Update RLS Policies for jobs to be company-aware
-- First, drop old policies that might conflict
DROP POLICY IF EXISTS "Jobs are viewable based on roles" ON jobs;

CREATE POLICY "Jobs are viewable by company members" ON jobs
  FOR SELECT USING (
    -- User is in the same company as the job
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = jobs.company_id
    )
    -- OR user is a super admin
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Jobs can be updated by company members" ON jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = jobs.company_id
    )
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Jobs can be deleted by company members" ON jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = jobs.company_id
    )
    OR is_super_admin(auth.uid())
  );

-- 6. Update RLS Policies for job_photos
DROP POLICY IF EXISTS "Job photos are viewable based on roles" ON job_photos;

CREATE POLICY "Job photos are viewable by company members" ON job_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.company_id = j.company_id
      WHERE j.id = job_photos.job_id
      AND p.id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

-- 7. Update RLS Policies for notes
DROP POLICY IF EXISTS "Notes are viewable based on roles" ON notes;

CREATE POLICY "Notes are viewable by company members" ON notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN profiles p ON p.company_id = j.company_id
      WHERE j.id = notes.job_id
      AND p.id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );
