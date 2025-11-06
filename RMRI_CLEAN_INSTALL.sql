-- ============================================
-- RMRI CLEAN INSTALL - DROPS AND RECREATES ALL TABLES
-- ============================================
-- This script will DELETE all existing RMRI data and recreate tables
-- USE WITH CAUTION - ALL RMRI DATA WILL BE LOST
-- ============================================

-- 1. Drop all existing tables (cascade deletes all data)
DROP TABLE IF EXISTS context_versions CASCADE;
DROP TABLE IF EXISTS contexts CASCADE;
DROP TABLE IF EXISTS rmri_logs CASCADE;
DROP TABLE IF EXISTS rmri_results CASCADE;
DROP TABLE IF EXISTS rmri_agents CASCADE;
DROP TABLE IF EXISTS rmri_iterations CASCADE;
DROP TABLE IF EXISTS rmri_papers CASCADE;
DROP TABLE IF EXISTS rmri_runs CASCADE;

-- 2. Create rmri_runs table
CREATE TABLE rmri_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  max_iterations INTEGER DEFAULT 3,
  convergence_threshold DECIMAL(3, 2) DEFAULT 0.7,
  selected_domains TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_iteration INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  results JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_rmri_runs_workspace ON rmri_runs(workspace_id);
CREATE INDEX idx_rmri_runs_user ON rmri_runs(user_id);
CREATE INDEX idx_rmri_runs_status ON rmri_runs(status);
CREATE INDEX idx_rmri_runs_created ON rmri_runs(created_at);

-- 3. Create rmri_papers table
CREATE TABLE rmri_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rmri_papers_run ON rmri_papers(run_id);
CREATE INDEX idx_rmri_papers_workspace ON rmri_papers(workspace_id);
CREATE INDEX idx_rmri_papers_user ON rmri_papers(user_id);

-- 4. Create rmri_iterations table
CREATE TABLE rmri_iterations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  gaps_found JSONB DEFAULT '[]',
  insights JSONB DEFAULT '{}',
  convergence_score DECIMAL(3, 2),
  processing_time INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(run_id, iteration_number)
);

CREATE INDEX idx_rmri_iterations_run ON rmri_iterations(run_id);
CREATE INDEX idx_rmri_iterations_status ON rmri_iterations(status);

-- 5. Create rmri_agents table
CREATE TABLE rmri_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('micro', 'meso', 'meta')),
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  processing_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_rmri_agents_run ON rmri_agents(run_id);
CREATE INDEX idx_rmri_agents_iteration ON rmri_agents(run_id, iteration_number);
CREATE INDEX idx_rmri_agents_type ON rmri_agents(agent_type);
CREATE INDEX idx_rmri_agents_status ON rmri_agents(status);

-- 6. Create rmri_results table
CREATE TABLE rmri_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  result_type TEXT NOT NULL CHECK (result_type IN ('gaps', 'clusters', 'synthesis')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rmri_results_run ON rmri_results(run_id);
CREATE INDEX idx_rmri_results_iteration ON rmri_results(run_id, iteration_number);

-- 7. Create rmri_logs table
CREATE TABLE rmri_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'debug')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rmri_logs_run ON rmri_logs(run_id);
CREATE INDEX idx_rmri_logs_level ON rmri_logs(level);
CREATE INDEX idx_rmri_logs_created ON rmri_logs(created_at);

-- 7.5. Create contexts table (for context storage service)
CREATE TABLE IF NOT EXISTS contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  agent_id UUID,
  context_key TEXT NOT NULL,
  context_value JSONB,
  storage_path TEXT,
  storage_type TEXT DEFAULT 'supabase_storage',
  size_bytes INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contexts_run ON contexts(run_id);
CREATE INDEX idx_contexts_agent ON contexts(agent_id);
CREATE INDEX idx_contexts_key ON contexts(context_key);
CREATE INDEX idx_contexts_created ON contexts(created_at);

-- 7.6. Create context_versions table (for version tracking)
CREATE TABLE IF NOT EXISTS context_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  operation TEXT CHECK (operation IN ('append', 'overwrite', 'create')),
  modified_by_agent_id UUID,
  diff_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_versions_context ON context_versions(context_id);
CREATE INDEX idx_context_versions_version ON context_versions(context_id, version);

-- 8. Enable Row Level Security
ALTER TABLE rmri_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_versions ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for rmri_runs
CREATE POLICY "Users can view runs in their workspaces" ON rmri_runs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create runs in their workspaces" ON rmri_runs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "System can update runs" ON rmri_runs
  FOR UPDATE USING (true) WITH CHECK (true);

-- 10. Create RLS policies for rmri_papers
CREATE POLICY "Users can view papers in their workspace runs" ON rmri_papers
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert papers for their runs" ON rmri_papers
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete their own papers" ON rmri_papers
  FOR DELETE USING (user_id = auth.uid()::text);

-- 11. Create RLS policies for rmri_iterations
CREATE POLICY "Users can view iterations of runs in their workspaces" ON rmri_iterations
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      ) OR workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can insert/update iterations" ON rmri_iterations
  FOR ALL USING (true) WITH CHECK (true);

-- 12. Create RLS policies for rmri_agents
CREATE POLICY "Users can view agents of runs in their workspaces" ON rmri_agents
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      ) OR workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage agents" ON rmri_agents
  FOR ALL USING (true) WITH CHECK (true);

-- 13. Create RLS policies for rmri_results
CREATE POLICY "Users can view results in their workspaces" ON rmri_results
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      ) OR workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage results" ON rmri_results
  FOR ALL USING (true) WITH CHECK (true);

-- 14. Create RLS policies for rmri_logs
CREATE POLICY "Users can view logs in their workspaces" ON rmri_logs
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      ) OR workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage logs" ON rmri_logs
  FOR ALL USING (true) WITH CHECK (true);

-- 14.5. Create RLS policies for contexts
CREATE POLICY "System can manage contexts" ON contexts
  FOR ALL USING (true) WITH CHECK (true);

-- 14.6. Create RLS policies for context_versions
CREATE POLICY "System can manage context versions" ON context_versions
  FOR ALL USING (true) WITH CHECK (true);

-- 15. Create auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_rmri_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rmri_runs_updated_at_trigger
  BEFORE UPDATE ON rmri_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_rmri_runs_updated_at();

-- Done! All RMRI tables created with clean slate.
