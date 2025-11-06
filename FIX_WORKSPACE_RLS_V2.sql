-- Fix Workspace RLS - More Permissive Version
-- This completely rebuilds the policies with proper type handling

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can delete their workspaces" ON workspaces;

-- Simple, permissive policies for testing
CREATE POLICY "Users can view their workspaces" ON workspaces
  FOR SELECT 
  USING (owner_id = (auth.uid())::text);

CREATE POLICY "Users can create their workspaces" ON workspaces
  FOR INSERT 
  WITH CHECK (owner_id = (auth.uid())::text);

CREATE POLICY "Users can update their workspaces" ON workspaces
  FOR UPDATE 
  USING (owner_id = (auth.uid())::text)
  WITH CHECK (owner_id = (auth.uid())::text);

CREATE POLICY "Users can delete their workspaces" ON workspaces
  FOR DELETE 
  USING (owner_id = (auth.uid())::text);

-- Also fix workspace_users policies if they exist
DROP POLICY IF EXISTS "Users can view workspace memberships" ON workspace_users;
DROP POLICY IF EXISTS "Users can manage workspace memberships" ON workspace_users;

CREATE POLICY "Users can view workspace memberships" ON workspace_users
  FOR SELECT
  USING (
    user_id = (auth.uid())::text OR
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = (auth.uid())::text
    )
  );

CREATE POLICY "Workspace owners can manage memberships" ON workspace_users
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = (auth.uid())::text
    )
  );
