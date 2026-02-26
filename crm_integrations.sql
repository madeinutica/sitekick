-- ─── Decentralized CRM Integration Migration ────────────────────────────
-- This migration moves MarketSharp configuration to the company level
-- and scopes all synchronized data by company_id.

-- 1. Add configuration column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS marketsharp_config jsonb DEFAULT NULL;

-- 2. Add company_id to MarketSharp tables
ALTER TABLE ms_contacts 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

ALTER TABLE ms_jobs 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

ALTER TABLE ms_sync_log 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- 3. Update Unique Constraints to be scoped by company
-- ms_contacts
ALTER TABLE ms_contacts DROP CONSTRAINT IF EXISTS ms_contacts_marketsharp_id_key;
DROP INDEX IF EXISTS idx_ms_contacts_marketsharp_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ms_contacts_company_ms_id ON ms_contacts(company_id, marketsharp_id);

-- ms_jobs
ALTER TABLE ms_jobs DROP CONSTRAINT IF EXISTS ms_jobs_marketsharp_id_key;
DROP INDEX IF EXISTS idx_ms_jobs_marketsharp_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ms_jobs_company_ms_id ON ms_jobs(company_id, marketsharp_id);

-- 4. RLS Policy Updates

-- ms_contacts
DROP POLICY IF EXISTS "Super admins can view MarketSharp contacts" ON ms_contacts;
DROP POLICY IF EXISTS "Service role can manage MarketSharp contacts" ON ms_contacts;

CREATE POLICY "Company admins can view own MarketSharp contacts" ON ms_contacts
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = ms_contacts.company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'company_admin'
      )
    ))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Service role can manage all MarketSharp contacts" ON ms_contacts
  FOR ALL USING (true) WITH CHECK (true);

-- ms_jobs
DROP POLICY IF EXISTS "Super admins can view MarketSharp jobs" ON ms_jobs;
DROP POLICY IF EXISTS "Service role can manage MarketSharp jobs" ON ms_jobs;

CREATE POLICY "Company admins can view own MarketSharp jobs" ON ms_jobs
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = ms_jobs.company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'company_admin'
      )
    ))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Service role can manage all MarketSharp jobs" ON ms_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- ms_sync_log
DROP POLICY IF EXISTS "Super admins can view sync logs" ON ms_sync_log;
DROP POLICY IF EXISTS "Service role can manage sync logs" ON ms_sync_log;

CREATE POLICY "Company admins can view own sync logs" ON ms_sync_log
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = ms_sync_log.company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'company_admin'
      )
    ))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Service role can manage all sync logs" ON ms_sync_log
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Companies RLS for config
-- Ensure only Company Admins (and Super Admins) can see/edit the marketsharp_config
-- Note: 'companies' table already has "Companies are viewable by authenticated users"
-- We might need to restrict UPDATE to company_admin

CREATE POLICY "Company admins can update own company" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.company_id = companies.id
      AND EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'company_admin'
      )
    )
    OR is_super_admin(auth.uid())
  );
