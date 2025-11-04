-- Missing Tables for Backend Completion
-- Run this in Supabase SQL Editor
-- Creates: chart_exports, humanizer_logs

-- ===========================================
-- TABLE: chart_exports
-- Purpose: Store exported visualization charts
-- ===========================================

DROP TABLE IF EXISTS chart_exports CASCADE;

CREATE TABLE chart_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bar', 'line', 'pie', 'scatter', 'heatmap', 'network')),
  title TEXT,
  params JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chart_exports_workspace ON chart_exports(workspace_id);
CREATE INDEX idx_chart_exports_user ON chart_exports(user_id);
CREATE INDEX idx_chart_exports_created ON chart_exports(created_at DESC);

-- RLS Policies
ALTER TABLE chart_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace chart exports" ON chart_exports;
DROP POLICY IF EXISTS "Users can create chart exports" ON chart_exports;
DROP POLICY IF EXISTS "Users can delete own chart exports" ON chart_exports;

CREATE POLICY "Users can view workspace chart exports"
  ON chart_exports FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create chart exports"
  ON chart_exports FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
      AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Users can delete own chart exports"
  ON chart_exports FOR DELETE
  USING (user_id = auth.uid()::text);

-- ===========================================
-- TABLE: humanizer_logs
-- Purpose: Log all text humanization requests
-- ===========================================

DROP TABLE IF EXISTS humanizer_logs CASCADE;

CREATE TABLE humanizer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cerebras', 'huggingface', 'openai', 'anthropic')),
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_humanizer_logs_user ON humanizer_logs(user_id);
CREATE INDEX idx_humanizer_logs_workspace ON humanizer_logs(workspace_id);
CREATE INDEX idx_humanizer_logs_created ON humanizer_logs(created_at DESC);
CREATE INDEX idx_humanizer_logs_provider ON humanizer_logs(provider);

-- RLS Policies
ALTER TABLE humanizer_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own humanizer logs" ON humanizer_logs;
DROP POLICY IF EXISTS "Users can create humanizer logs" ON humanizer_logs;

CREATE POLICY "Users can view own humanizer logs"
  ON humanizer_logs FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create humanizer logs"
  ON humanizer_logs FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ===========================================
-- Enable Realtime (Optional)
-- ===========================================

DO $$
BEGIN
  -- Add chart_exports to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chart_exports;
    RAISE NOTICE '✅ Added chart_exports to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ chart_exports already in realtime publication';
  END;

  -- Add humanizer_logs to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE humanizer_logs;
    RAISE NOTICE '✅ Added humanizer_logs to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ humanizer_logs already in realtime publication';
  END;
END $$;

-- ===========================================
-- Success Message
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Missing tables created successfully!';
  RAISE NOTICE '   - chart_exports: Store visualization exports';
  RAISE NOTICE '   - humanizer_logs: Track AI text humanization';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh Supabase schema';
  RAISE NOTICE '2. Test chart export endpoints';
  RAISE NOTICE '3. Test enhanced humanizer with logging';
END $$;
