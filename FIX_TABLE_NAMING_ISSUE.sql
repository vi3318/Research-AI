-- =====================================================
-- CRITICAL FIX: Table Naming Alignment
-- =====================================================
-- Problem: You have BOTH workspace_users AND workspace_collaborators tables!
-- This is a schema duplication issue - data might be split between them.
-- =====================================================

-- STEP 1: Check which table has your actual data
-- Run this query to see:

SELECT 'workspace_users' as table_name, COUNT(*) as row_count 
FROM workspace_users
UNION ALL
SELECT 'workspace_collaborators' as table_name, COUNT(*) as row_count 
FROM workspace_collaborators;

-- STEP 2: Check the structure of each table

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workspace_users' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workspace_collaborators' 
ORDER BY ordinal_position;

-- =====================================================
-- TEMPORARY FIX: Do nothing for now
-- =====================================================
-- Since both tables exist, the backend code should work.
-- The issue is likely that your data is in workspace_users
-- but the fixed code is now querying workspace_collaborators (which is empty).

-- =====================================================
-- SOLUTION OPTIONS:
-- =====================================================

-- Option A: Copy data from workspace_users to workspace_collaborators
/*
INSERT INTO workspace_collaborators 
SELECT * FROM workspace_users 
ON CONFLICT (workspace_id, user_id) DO NOTHING;
*/

-- Option B: Drop workspace_collaborators and keep workspace_users
-- (Then revert all my code changes back to workspace_users)

-- Option C: Drop workspace_users and keep workspace_collaborators  
-- (Keep my code changes, migrate data first)

-- =====================================================
-- RECOMMENDED: Copy data to workspace_collaborators
-- =====================================================
-- The workspace_users table has user_id as TEXT, need to cast to UUID

-- Cast user_id to UUID during insert
INSERT INTO workspace_collaborators (id, workspace_id, user_id, role, joined_at)
SELECT id, workspace_id, user_id::uuid, role, joined_at
FROM workspace_users
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- If the above still fails, try this alternative:
-- INSERT INTO workspace_collaborators (workspace_id, user_id, role)
-- SELECT workspace_id, user_id::uuid, role
-- FROM workspace_users
-- ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to see which table actually exists in your database:
/*
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspace_users', 'workspace_collaborators');
*/
