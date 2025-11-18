-- Check current RLS policies for jobs table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY cmd;

-- Also check if super admin can delete jobs
-- This should show the DELETE policy that allows super admins