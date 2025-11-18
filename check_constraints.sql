-- Check current foreign key constraints and add missing CASCADE DELETE
-- Also add CASCADE DELETE for photo_tags -> job_photos relationship

-- Add CASCADE DELETE to photo_tags foreign key constraint
ALTER TABLE photo_tags DROP CONSTRAINT IF EXISTS photo_tags_photo_id_fkey;
ALTER TABLE photo_tags ADD CONSTRAINT photo_tags_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES job_photos(id) ON DELETE CASCADE;

-- Verify all CASCADE DELETE constraints are in place
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.table_schema
WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'jobs'
ORDER BY tc.table_name;