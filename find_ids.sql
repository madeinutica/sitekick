-- Find Erick and New York Sash
SELECT p.id as profile_id, p.full_name, p.company_id, c.id as company_id_target, c.name
FROM profiles p
LEFT JOIN companies c ON c.name ILIKE '%New York Sash%'
WHERE p.full_name ILIKE '%Erick%' OR p.username ILIKE '%Erick%';
