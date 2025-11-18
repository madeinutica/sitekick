-- Test queries to verify RLS setup
-- Check if is_super_admin function exists and works
SELECT proname, prokind FROM pg_proc WHERE proname = 'is_super_admin';

-- Test the function with your user ID
SELECT is_super_admin('de81c896-89e6-45b7-9f0e-3933a42aeb64');

-- Check current policies on user_roles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_roles';

-- Check current policies on jobs
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'jobs';

-- Check your roles
SELECT ur.user_id, r.name, r.permissions
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'de81c896-89e6-45b7-9f0e-3933a42aeb64';

-- Try a simple jobs query (should work if policies are correct)
SELECT COUNT(*) FROM jobs;