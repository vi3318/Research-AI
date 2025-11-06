-- ============================================
-- CREATE RMRI TABLES - RUN THIS IN SUPABASE
-- ============================================
-- Copy this entire file and paste it into:
-- Supabase Dashboard > SQL Editor > New Query
-- Then click "Run" button
-- ============================================

-- 1. Create rmri_runs table
CREATE TABLE IF NOT EXISTS rmri_runs (
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

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rmri_runs_workspace ON rmri_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rmri_runs_user ON rmri_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_rmri_runs_status ON rmri_runs(status);
CREATE INDEX IF NOT EXISTS idx_rmri_runs_created ON rmri_runs(created_at);

-- 3. Create rmri_papers table (papers associated with runs)
CREATE TABLE IF NOT EXISTS rmri_papers (
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

-- 4. Create indexes for rmri_papers
CREATE INDEX IF NOT EXISTS idx_rmri_papers_run ON rmri_papers(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_papers_workspace ON rmri_papers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rmri_papers_user ON rmri_papers(user_id);

-- 5. Create rmri_iterations table (track each iteration of analysis)
CREATE TABLE IF NOT EXISTS rmri_iterations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  gaps_found JSONB DEFAULT '[]',
  insights JSONB DEFAULT '{}',
  convergence_score DECIMAL(3, 2),
  processing_time INTEGER, -- in seconds
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(run_id, iteration_number)
);

-- 6. Create indexes for rmri_iterations
CREATE INDEX IF NOT EXISTS idx_rmri_iterations_run ON rmri_iterations(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_iterations_status ON rmri_iterations(status);

-- 6b. Create rmri_agents table (track agent executions)
CREATE TABLE IF NOT EXISTS rmri_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('micro', 'meso', 'meta')),
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  processing_time INTEGER, -- in milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6c. Create indexes for rmri_agents
CREATE INDEX IF NOT EXISTS idx_rmri_agents_run ON rmri_agents(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_iteration ON rmri_agents(run_id, iteration_number);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_type ON rmri_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_status ON rmri_agents(status);

-- 6d. Create rmri_results table (store final analysis results)
CREATE TABLE IF NOT EXISTS rmri_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  result_type TEXT NOT NULL CHECK (result_type IN ('gaps', 'clusters', 'synthesis')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rmri_results_run ON rmri_results(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_results_iteration ON rmri_results(run_id, iteration_number);

-- 6e. Create rmri_logs table (detailed logging)
CREATE TABLE IF NOT EXISTS rmri_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'debug')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rmri_logs_run ON rmri_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_logs_level ON rmri_logs(level);
CREATE INDEX IF NOT EXISTS idx_rmri_logs_created ON rmri_logs(created_at);

-- 7. Enable Row Level Security
ALTER TABLE rmri_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_logs ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for rmri_runs

-- Allow users to view runs in their workspaces
CREATE POLICY "Users can view runs in their workspaces" ON rmri_runs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to create runs in their workspaces
CREATE POLICY "Users can create runs in their workspaces" ON rmri_runs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to update their own runs
CREATE POLICY "Users can update their own runs" ON rmri_runs
  FOR UPDATE USING (
    user_id = auth.uid()::text OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to delete their own runs or admins can delete
CREATE POLICY "Users can delete their own runs or admins can delete" ON rmri_runs
  FOR DELETE USING (
    user_id = auth.uid()::text OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text AND role IN ('owner', 'admin')
    )
  );

-- 9. Create RLS policies for rmri_papers

CREATE POLICY "Users can view papers in their workspace runs" ON rmri_papers
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert papers for their runs" ON rmri_papers
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete their own papers" ON rmri_papers
  FOR DELETE USING (
    user_id = auth.uid()::text
  );

-- 10. Create RLS policies for rmri_iterations

CREATE POLICY "Users can view iterations of runs in their workspaces" ON rmri_iterations
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can insert/update iterations" ON rmri_iterations
  FOR ALL USING (true) WITH CHECK (true);

-- 10b. Create RLS policies for rmri_agents

CREATE POLICY "Users can view agents of runs in their workspaces" ON rmri_agents
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage agents" ON rmri_agents
  FOR ALL USING (true) WITH CHECK (true);

-- 10c. Create RLS policies for rmri_results

CREATE POLICY "Users can view results in their workspaces" ON rmri_results
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage results" ON rmri_results
  FOR ALL USING (true) WITH CHECK (true);

-- 10d. Create RLS policies for rmri_logs

CREATE POLICY "Users can view logs in their workspaces" ON rmri_logs
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM rmri_runs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can manage logs" ON rmri_logs
  FOR ALL USING (true) WITH CHECK (true);

-- 11. Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rmri_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_rmri_runs_updated_at_trigger ON rmri_runs;
CREATE TRIGGER update_rmri_runs_updated_at_trigger
  BEFORE UPDATE ON rmri_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_rmri_runs_updated_at();

-- Done! RMRI tables created successfully.
-- You can now start RMRI analysis runs.
