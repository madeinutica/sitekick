-- 1. Create companies for existing unique company names in profiles
INSERT INTO companies (name)
SELECT DISTINCT company 
FROM profiles 
WHERE company IS NOT NULL AND company != ''
ON CONFLICT (name) DO NOTHING;

-- 2. Link profiles to companies
UPDATE profiles p
SET company_id = c.id
FROM companies c
WHERE p.company = c.name
AND p.company_id IS NULL;

-- 3. Link existing jobs to companies based on owner's profile
UPDATE jobs j
SET company_id = p.company_id
FROM profiles p
WHERE j.user_id = p.id
AND j.company_id IS NULL;
