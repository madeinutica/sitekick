-- Check if user has super_admin role
SELECT ur.user_id, r.name 
FROM user_roles ur 
JOIN roles r ON ur.role_id = r.id 
WHERE ur.user_id = 'de81c896-89e6-45b7-9f0e-3933a42aeb64';