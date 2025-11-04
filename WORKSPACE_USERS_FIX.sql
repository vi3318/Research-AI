-- Complete fix for workspace_users and users relationship
-- Run this in Supabase SQL Editor

-- Step 1: Ensure users table exists with correct structure
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Backfill users from Supabase auth
INSERT INTO public.users (id, email, name)
SELECT 
  id::text,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Step 3: Add foreign key constraint from workspace_users to users
-- First, drop the constraint if it exists
ALTER TABLE workspace_users 
  DROP CONSTRAINT IF EXISTS workspace_users_user_id_fkey;

-- Add the foreign key constraint
ALTER TABLE workspace_users
  ADD CONSTRAINT workspace_users_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

-- Step 4: Verify the relationship
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_name = 'workspace_users_user_id_fkey'
    AND table_name = 'workspace_users';
  
  IF fk_count > 0 THEN
    RAISE NOTICE '✅ Foreign key relationship created successfully!';
  ELSE
    RAISE NOTICE '❌ Foreign key relationship failed to create!';
  END IF;
END $$;

-- Step 5: Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid()::text);

-- Step 6: Create trigger for auto-updating users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Complete! Relationship between workspace_users and users is now established.';
  RAISE NOTICE 'Refresh your workspace page and try clicking on a workspace.';
END $$;
