-- Count jobs with and without company_id
SELECT 
  count(*) filter (where company_id is null) as null_company_count,
  count(*) filter (where company_id is not null) as with_company_count
FROM jobs;

-- Check if trigger is present
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'jobs' AND trigger_name = 'tr_job_company_assignment';

-- Check profiles for users with no company_id
SELECT count(*) FROM profiles WHERE company_id IS NULL;
