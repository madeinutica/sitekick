-- Check RLS policies for jobs
SELECT tablename, policyname, definition 
FROM pg_policies 
WHERE tablename = 'jobs';

-- Check a sample of assignments and job company links
SELECT j.id as job_id, j.job_name, j.company_id as job_company, ja.user_id as assigned_user, p.company_id as user_company
FROM jobs j
LEFT JOIN job_assignments ja ON j.id = ja.job_id
LEFT JOIN profiles p ON ja.user_id = p.id
LIMIT 10;
