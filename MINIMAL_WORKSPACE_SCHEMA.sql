-- =========================================
-- MINIMAL WORKSPACE SCHEMA - Essential Tables Only
-- Run this in your Supabase SQL Editor to fix workspace functionality
-- =========================================

-- 1. WORKSPACES - Collaborative research environments
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created ON workspaces(created_at);

-- 2. WORKSPACE MEMBERS - User permissions in workspaces  
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member')),
  permissions JSONB DEFAULT '{}',
  invited_by TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate memberships
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user ON workspace_users(user_id);

-- 3. WORKSPACE PAPERS - Research papers saved to workspaces
CREATE TABLE IF NOT EXISTS workspace_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL,
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Prevent duplicate papers in same workspace
  UNIQUE(workspace_id, paper_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_papers_workspace ON workspace_papers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_papers_paper ON workspace_papers(paper_id);

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_papers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspaces
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

-- Create RLS policies for workspace_users
CREATE POLICY "Users can view workspace memberships" ON workspace_users
  FOR SELECT USING (
    user_id = auth.uid()::text OR
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace owners can manage members" ON workspace_users
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

-- Create RLS policies for workspace_papers
CREATE POLICY "Users can view papers in their workspaces" ON workspace_papers
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can add papers" ON workspace_papers
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

-- Create function to automatically add workspace owner as a member
CREATE OR REPLACE FUNCTION add_workspace_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_users (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add workspace owner as member
CREATE TRIGGER add_workspace_owner_trigger
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION add_workspace_owner_as_member();

-- Update workspace updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_updated_at_trigger
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_updated_at();
