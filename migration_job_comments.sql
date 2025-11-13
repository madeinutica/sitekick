-- Migration for job_comments table
CREATE TABLE IF NOT EXISTS job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES job_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_job_comments_job_id ON job_comments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_comments_parent_id ON job_comments(parent_id);

-- Policy: Only super users and site leads can insert/read
-- (Assume is_super_user and is_site_lead columns on profiles)
CREATE POLICY "Allow super users and site leads to read job comments" ON job_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_super_user OR p.is_site_lead)
    )
  );

CREATE POLICY "Allow super users and site leads to insert job comments" ON job_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_super_user OR p.is_site_lead)
    )
  );

CREATE POLICY "Allow super users and site leads to update their own comments" ON job_comments
  FOR UPDATE USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_super_user OR p.is_site_lead)
    )
  );

CREATE POLICY "Allow super users and site leads to delete their own comments" ON job_comments
  FOR DELETE USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_super_user OR p.is_site_lead)
    )
  );
