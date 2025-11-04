-- RMRI Foundation Schema Migration
-- Recursive Multi-Agent Research Intelligence System

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RMRI Runs Table
-- Tracks overall research runs initiated by users
CREATE TABLE IF NOT EXISTS rmri_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    query TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'initializing' CHECK (status IN ('initializing', 'planning', 'executing', 'synthesizing', 'completed', 'failed', 'cancelled')),
    config JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RMRI Agents Table
-- Individual agents within a research run
CREATE TABLE IF NOT EXISTS rmri_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
    agent_type VARCHAR(100) NOT NULL CHECK (agent_type IN ('planner', 'searcher', 'analyzer', 'synthesizer', 'critic', 'validator')),
    agent_name VARCHAR(255) NOT NULL,
    parent_agent_id UUID REFERENCES rmri_agents(id) ON DELETE SET NULL,
    depth_level INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed', 'skipped')),
    input_context JSONB,
    output_summary JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contexts Table
-- Stores metadata and pointers to actual context files
CREATE TABLE IF NOT EXISTS contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES rmri_agents(id) ON DELETE SET NULL,
    context_key VARCHAR(500) NOT NULL,
    storage_path TEXT NOT NULL,
    storage_type VARCHAR(50) DEFAULT 'supabase_storage' CHECK (storage_type IN ('supabase_storage', 'local_file', 'database')),
    size_bytes BIGINT DEFAULT 0,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    summary TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(run_id, agent_id, context_key, version)
);

-- Context Versions Table
-- Tracks all versions of context modifications
CREATE TABLE IF NOT EXISTS context_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    operation VARCHAR(50) CHECK (operation IN ('create', 'append', 'overwrite', 'delete')),
    modified_by_agent_id UUID REFERENCES rmri_agents(id) ON DELETE SET NULL,
    diff_summary TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(context_id, version)
);

-- RMRI Results Table
-- Stores final and intermediate results from agents
CREATE TABLE IF NOT EXISTS rmri_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES rmri_agents(id) ON DELETE SET NULL,
    result_type VARCHAR(100) NOT NULL CHECK (result_type IN ('search_results', 'analysis', 'synthesis', 'hypothesis', 'critique', 'final_report')),
    content JSONB NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    sources JSONB DEFAULT '[]',
    is_final BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RMRI Logs Table
-- Detailed execution logs for debugging and monitoring
CREATE TABLE IF NOT EXISTS rmri_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES rmri_agents(id) ON DELETE SET NULL,
    log_level VARCHAR(20) DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    context_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RMRI Feedback Table
-- User feedback on results for continuous improvement
CREATE TABLE IF NOT EXISTS rmri_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES rmri_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    result_id UUID REFERENCES rmri_results(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('quality', 'relevance', 'accuracy', 'completeness', 'general')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_rmri_runs_user_id ON rmri_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_rmri_runs_status ON rmri_runs(status);
CREATE INDEX IF NOT EXISTS idx_rmri_runs_created_at ON rmri_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rmri_agents_run_id ON rmri_agents(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_type ON rmri_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_parent ON rmri_agents(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_rmri_agents_status ON rmri_agents(status);

CREATE INDEX IF NOT EXISTS idx_contexts_run_id ON contexts(run_id);
CREATE INDEX IF NOT EXISTS idx_contexts_agent_id ON contexts(agent_id);
CREATE INDEX IF NOT EXISTS idx_contexts_key ON contexts(context_key);
CREATE INDEX IF NOT EXISTS idx_contexts_active ON contexts(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_context_versions_created ON context_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rmri_results_run_id ON rmri_results(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_results_agent_id ON rmri_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_rmri_results_type ON rmri_results(result_type);
CREATE INDEX IF NOT EXISTS idx_rmri_results_final ON rmri_results(is_final) WHERE is_final = TRUE;

CREATE INDEX IF NOT EXISTS idx_rmri_logs_run_id ON rmri_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_logs_level ON rmri_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_rmri_logs_timestamp ON rmri_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rmri_feedback_run_id ON rmri_feedback(run_id);
CREATE INDEX IF NOT EXISTS idx_rmri_feedback_user_id ON rmri_feedback(user_id);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rmri_runs_updated_at BEFORE UPDATE ON rmri_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rmri_agents_updated_at BEFORE UPDATE ON rmri_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contexts_updated_at BEFORE UPDATE ON contexts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE rmri_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rmri_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only access their own runs
CREATE POLICY "Users can view own runs" ON rmri_runs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own runs" ON rmri_runs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs" ON rmri_runs
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can access agents from their runs
CREATE POLICY "Users can view agents from own runs" ON rmri_agents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rmri_runs 
            WHERE rmri_runs.id = rmri_agents.run_id 
            AND rmri_runs.user_id = auth.uid()
        )
    );

-- Users can access contexts from their runs
CREATE POLICY "Users can view contexts from own runs" ON contexts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rmri_runs 
            WHERE rmri_runs.id = contexts.run_id 
            AND rmri_runs.user_id = auth.uid()
        )
    );

-- Users can access results from their runs
CREATE POLICY "Users can view results from own runs" ON rmri_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rmri_runs 
            WHERE rmri_runs.id = rmri_results.run_id 
            AND rmri_runs.user_id = auth.uid()
        )
    );

-- Users can access logs from their runs
CREATE POLICY "Users can view logs from own runs" ON rmri_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rmri_runs 
            WHERE rmri_runs.id = rmri_logs.run_id 
            AND rmri_runs.user_id = auth.uid()
        )
    );

-- Users can provide feedback on their runs
CREATE POLICY "Users can create feedback for own runs" ON rmri_feedback
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM rmri_runs 
            WHERE rmri_runs.id = rmri_feedback.run_id 
            AND rmri_runs.user_id = auth.uid()
        )
    );

-- Create storage bucket for RMRI contexts (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('rmri-contexts', 'rmri-contexts', false);

-- Storage policy for contexts bucket
-- CREATE POLICY "Users can access own context files" ON storage.objects
--     FOR ALL USING (
--         bucket_id = 'rmri-contexts' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

COMMENT ON TABLE rmri_runs IS 'Tracks RMRI research runs with status and configuration';
COMMENT ON TABLE rmri_agents IS 'Individual agents executing within research runs';
COMMENT ON TABLE contexts IS 'Metadata for context files stored in Supabase Storage';
COMMENT ON TABLE context_versions IS 'Version history for context modifications';
COMMENT ON TABLE rmri_results IS 'Results and outputs from agent executions';
COMMENT ON TABLE rmri_logs IS 'Execution logs for monitoring and debugging';
COMMENT ON TABLE rmri_feedback IS 'User feedback for continuous improvement';
