-- Add category column to jobs table
ALTER TABLE jobs ADD COLUMN category TEXT NOT NULL DEFAULT 'Windows';

-- Add check constraint to ensure category is one of the allowed values
ALTER TABLE jobs ADD CONSTRAINT jobs_category_check
CHECK (category IN ('Windows', 'Bathrooms', 'Siding', 'Doors'));

-- Create index on category for better query performance
CREATE INDEX idx_jobs_category ON jobs(category);