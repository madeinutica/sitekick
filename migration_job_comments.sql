-- Migration to fix notes/comments visibility
-- Allow users to see all notes for jobs they have access to

-- First, enable RLS on notes table if not already enabled
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Notes are viewable by the user who created them." ON notes;
DROP POLICY IF EXISTS "Notes are viewable by users who can access the job." ON notes;
DROP POLICY IF EXISTS "Users can insert their own notes." ON notes;
DROP POLICY IF EXISTS "Users can insert notes on jobs they can access." ON notes;
DROP POLICY IF EXISTS "Users can update their own notes." ON notes;
DROP POLICY IF EXISTS "Users can update notes on jobs they can access." ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes." ON notes;
DROP POLICY IF EXISTS "Users can delete notes on jobs they can access." ON notes;

-- Create simplified policies that don't rely on complex subqueries
-- Allow users to view notes for jobs they own or if they're super users
CREATE POLICY "Notes are viewable by users who can access the job." ON notes
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_super_user = true
    )
  );

-- Allow users to insert notes on jobs they own or if they're super users
CREATE POLICY "Users can insert notes on jobs they can access." ON notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_super_user = true
      )
    )
  );

-- Allow users to update their own notes on jobs they can access
CREATE POLICY "Users can update notes on jobs they can access." ON notes
  FOR UPDATE USING (
    auth.uid() = user_id
    AND (
      job_id IN (
        SELECT id FROM jobs WHERE notes.job_id = jobs.id AND jobs.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_super_user = true
      )
    )
  );

-- Allow users to delete their own notes on jobs they can access
CREATE POLICY "Users can delete notes on jobs they can access." ON notes
  FOR DELETE USING (
    auth.uid() = user_id
    AND (
      job_id IN (
        SELECT id FROM jobs WHERE notes.job_id = jobs.id AND jobs.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_super_user = true
      )
    )
  );