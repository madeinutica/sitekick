-- Migration: Add new features for CompanyCam competition
-- Run this if you've already created the basic tables

-- Create avatars storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Set up storage policies for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Add additional columns to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='company') THEN
        ALTER TABLE profiles ADD COLUMN company text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='is_super_user') THEN
        ALTER TABLE profiles ADD COLUMN is_super_user boolean DEFAULT false;
    END IF;
END $$;

-- Make sure the job_photos bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'job_photos';

-- Create storage bucket for job photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_photos', 'job_photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop all existing storage policies and recreate them
DROP POLICY IF EXISTS "Job photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload job photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own job photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a job photo." ON storage.objects;
DROP POLICY IF EXISTS "Job photos are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Set up storage policies for job photos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'job_photos');

CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job_photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'job_photos' AND auth.role() = 'authenticated');

-- Add address column to jobs and make client_id nullable
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='jobs' AND column_name='address') THEN
        ALTER TABLE jobs ADD COLUMN address text;
    END IF;
    
    -- Make client_id nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='jobs' AND column_name='client_id') THEN
        ALTER TABLE jobs ALTER COLUMN client_id DROP NOT NULL;
    END IF;
END $$;

-- Rename description to job_name and drop client_id column
DO $$
BEGIN
    -- Rename description to job_name if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='jobs' AND column_name='description') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='jobs' AND column_name='job_name') THEN
        ALTER TABLE jobs RENAME COLUMN description TO job_name;
    END IF;
    
    -- Drop client_id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='jobs' AND column_name='client_id') THEN
        ALTER TABLE jobs DROP COLUMN client_id;
    END IF;
END $$;

-- Add columns to job_photos for better organization (skip if already added)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_photos' AND column_name='caption') THEN
        ALTER TABLE job_photos ADD COLUMN caption text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_photos' AND column_name='photo_type') THEN
        ALTER TABLE job_photos ADD COLUMN photo_type text DEFAULT 'progress';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_photos' AND column_name='latitude') THEN
        ALTER TABLE job_photos ADD COLUMN latitude double precision;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_photos' AND column_name='longitude') THEN
        ALTER TABLE job_photos ADD COLUMN longitude double precision;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_photos' AND column_name='location_accuracy') THEN
        ALTER TABLE job_photos ADD COLUMN location_accuracy double precision;
    END IF;
END $$;

-- Create photo_tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS photo_tags (
  id bigint generated by default as identity primary key,
  photo_id bigint references job_photos not null,
  tag text not null,
  user_id uuid references auth.users
);

-- Set up Row Level Security for photo_tags
ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Photo tags are viewable by the user who created them." ON photo_tags;
CREATE POLICY "Photo tags are viewable by the user who created them." ON photo_tags
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own photo tags." ON photo_tags;
CREATE POLICY "Users can insert their own photo tags." ON photo_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own photo tags." ON photo_tags;
CREATE POLICY "Users can delete their own photo tags." ON photo_tags
  FOR DELETE USING (auth.uid() = user_id);

-- Create notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS notes (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default now(),
  job_id bigint references jobs not null,
  photo_id bigint references job_photos,
  content text not null,
  user_id uuid references auth.users
);

-- Set up Row Level Security for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notes are viewable by the user who created them." ON notes;
CREATE POLICY "Notes are viewable by the user who created them." ON notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes." ON notes;
CREATE POLICY "Users can insert their own notes." ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes." ON notes;
CREATE POLICY "Users can update their own notes." ON notes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes." ON notes;
CREATE POLICY "Users can delete their own notes." ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for jobs to allow super users to see all jobs
DROP POLICY IF EXISTS "Jobs are viewable by the user who created them." ON jobs;
CREATE POLICY "Jobs are viewable by user or super user." ON jobs
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_user = true
    )
  );

-- Update RLS policies for job_photos to allow super users to see all photos
DROP POLICY IF EXISTS "Job photos are viewable by the user who created them." ON job_photos;
CREATE POLICY "Job photos are viewable by user or super user." ON job_photos
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_super_user = true
    )
  );

-- Create team_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_members (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default now(),
  email text not null,
  role text default 'member',
  invited_by uuid references auth.users not null,
  user_id uuid references auth.users
);

-- Set up Row Level Security for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members are viewable by the user who invited them." ON team_members;
CREATE POLICY "Team members are viewable by the user who invited them." ON team_members
  FOR SELECT USING (auth.uid() = invited_by);

DROP POLICY IF EXISTS "Users can invite team members." ON team_members;
CREATE POLICY "Users can invite team members." ON team_members
  FOR INSERT WITH CHECK (auth.uid() = invited_by);
