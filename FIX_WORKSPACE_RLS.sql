-- Fix Workspace RLS Policies (500 Error Fix)
-- This fixes the type mismatch causing 500 errors

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can delete their workspaces" ON workspaces;

-- Recreate with correct type handling (TEXT = UUID cast)
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid()::text OR
    id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create workspaces" ON workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Workspace owners can update their workspaces" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Workspace owners can delete their workspaces" ON workspaces
  FOR DELETE USING (owner_id = auth.uid()::text);
