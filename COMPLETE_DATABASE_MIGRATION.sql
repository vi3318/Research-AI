-- =====================================================
-- COMPLETE DATABASE MIGRATION
-- Run this in Supabase SQL Editor to create all tables
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- =====================================================
-- 1. DOCUMENT REVISIONS TABLE (With jsondiffpatch support)
-- =====================================================

CREATE TABLE IF NOT EXISTS document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  yjs_state BYTEA, -- Y.js binary state snapshot
  diff_summary JSONB, -- JSON diff from previous version (jsondiffpatch format)
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_summary TEXT DEFAULT 'Auto-save snapshot',
  word_count INTEGER DEFAULT 0,
  character_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_revisions_document ON document_revisions(document_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_created ON document_revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_user ON document_revisions(created_by);

COMMENT ON TABLE document_revisions IS 'Version history for documents with diff support';
COMMENT ON COLUMN document_revisions.diff_summary IS 'Compact JSON diff from previous revision (jsondiffpatch format)';
COMMENT ON COLUMN document_revisions.yjs_state IS 'Binary Y.js CRDT state snapshot';

-- =====================================================
-- 2. PAPERS TABLE (For metadata caching)
-- =====================================================

CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY, -- Can be DOI, arXiv ID, or OpenAlex ID
  title TEXT NOT NULL,
  authors TEXT[], -- Array of author names
  abstract TEXT,
  doi TEXT,
  arxiv_id TEXT,
  openalex_id TEXT,
  pdf_url TEXT,
  venue TEXT, -- Journal or conference name
  year INTEGER,
  publication_date DATE,
  citation_count INTEGER DEFAULT 0,
  keywords TEXT[], -- Array of keywords
  url TEXT,
  metadata JSONB DEFAULT '{}', -- Additional metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_arxiv ON papers(arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_openalex ON papers(openalex_id) WHERE openalex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_title_trgm ON papers USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_papers_updated ON papers(updated_at DESC);

COMMENT ON TABLE papers IS 'Cached paper metadata from OpenAlex, arXiv, etc.';
COMMENT ON COLUMN papers.id IS 'Primary identifier (DOI, arXiv ID, or OpenAlex ID)';

-- =====================================================
-- 3. CHART EXPORTS TABLE (Updated with new chart types)
-- =====================================================

DROP TABLE IF EXISTS chart_exports CASCADE;

CREATE TABLE chart_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('citation_trend', 'keyword_network', 'venue_distribution', 'bar', 'line', 'pie', 'scatter', 'heatmap')),
  title TEXT,
  params JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  data JSONB, -- Chart data (labels, values, etc.)
  metadata JSONB DEFAULT '{}', -- Additional metadata (colors, options, etc.)
  latency_ms INTEGER, -- Time taken to generate
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chart_exports_workspace ON chart_exports(workspace_id);
CREATE INDEX idx_chart_exports_user ON chart_exports(user_id);
CREATE INDEX idx_chart_exports_type ON chart_exports(type);
CREATE INDEX idx_chart_exports_created ON chart_exports(created_at DESC);

COMMENT ON TABLE chart_exports IS 'Server-side generated visualization charts';
COMMENT ON COLUMN chart_exports.data IS 'Chart data (years, counts, keywords, etc.)';

-- =====================================================
-- 4. HUMANIZER LOGS TABLE (Updated with new fields)
-- =====================================================

DROP TABLE IF EXISTS humanizer_logs CASCADE;

CREATE TABLE humanizer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cerebras', 'huggingface', 'gemini', 'openai', 'anthropic', 'sandbox')),
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  processing_time_ms INTEGER,
  llm_latency_ms INTEGER, -- Time for LLM call only
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  changes JSONB, -- Metadata about changes (length_ratio, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_humanizer_logs_user ON humanizer_logs(user_id);
CREATE INDEX idx_humanizer_logs_workspace ON humanizer_logs(workspace_id);
CREATE INDEX idx_humanizer_logs_created ON humanizer_logs(created_at DESC);
CREATE INDEX idx_humanizer_logs_provider ON humanizer_logs(provider);
CREATE INDEX idx_humanizer_logs_success ON humanizer_logs(success);

COMMENT ON TABLE humanizer_logs IS 'Log of all text humanization requests with quality metrics';
COMMENT ON COLUMN humanizer_logs.quality_score IS 'Quality score 0-100 from humanizer service';

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Document Revisions
ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view document revisions" ON document_revisions;
DROP POLICY IF EXISTS "Users can create document revisions" ON document_revisions;

CREATE POLICY "Users can view document revisions"
  ON document_revisions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE owner_id = auth.uid()::text 
      OR id IN (
        SELECT document_id FROM document_collaborators 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can create document revisions"
  ON document_revisions FOR INSERT
  WITH CHECK (created_by = auth.uid()::text);

-- Papers (Public read, authenticated write for caching)
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read papers" ON papers;
DROP POLICY IF EXISTS "Authenticated users can cache papers" ON papers;

CREATE POLICY "Anyone can read papers"
  ON papers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can cache papers"
  ON papers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update papers"
  ON papers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Chart Exports
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

-- Humanizer Logs
ALTER TABLE humanizer_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own humanizer logs" ON humanizer_logs;
DROP POLICY IF EXISTS "Users can create humanizer logs" ON humanizer_logs;

CREATE POLICY "Users can view own humanizer logs"
  ON humanizer_logs FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create humanizer logs"
  ON humanizer_logs FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to create revision snapshot (updated with diff support)
CREATE OR REPLACE FUNCTION create_revision_snapshot(
  p_document_id UUID,
  p_created_by TEXT,
  p_change_summary TEXT DEFAULT 'Auto-save snapshot'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revision_number INTEGER;
  v_revision_id UUID;
  v_content JSONB;
  v_yjs_state BYTEA;
  v_prev_content JSONB;
  v_diff_summary JSONB;
BEGIN
  -- Get current document content
  SELECT 
    document_content.content,
    document_content.yjs_state
  INTO 
    v_content,
    v_yjs_state
  FROM document_content
  WHERE document_id = p_document_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Get previous revision content for diff
  SELECT content INTO v_prev_content
  FROM document_revisions
  WHERE document_id = p_document_id
  ORDER BY revision_number DESC
  LIMIT 1;

  -- Calculate next revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1
  INTO v_revision_number
  FROM document_revisions
  WHERE document_id = p_document_id;

  -- Create diff summary (placeholder - in real app, use jsondiffpatch in backend)
  -- The backend should calculate this and pass it in
  v_diff_summary := jsonb_build_object(
    'has_changes', v_content IS DISTINCT FROM v_prev_content,
    'revision_number', v_revision_number,
    'timestamp', NOW()
  );

  -- Insert revision
  INSERT INTO document_revisions (
    document_id,
    revision_number,
    content,
    yjs_state,
    diff_summary,
    created_by,
    change_summary,
    word_count,
    character_count
  )
  VALUES (
    p_document_id,
    v_revision_number,
    v_content,
    v_yjs_state,
    v_diff_summary,
    p_created_by,
    p_change_summary,
    (SELECT word_count FROM documents WHERE id = p_document_id),
    length(v_content::text)
  )
  RETURNING id INTO v_revision_id;

  RETURN v_revision_id;
END;
$$;

COMMENT ON FUNCTION create_revision_snapshot IS 'Creates a revision snapshot with optional diff from previous version';

-- Function to clean old revisions (keep last N)
CREATE OR REPLACE FUNCTION cleanup_old_revisions(
  p_document_id UUID,
  p_keep_count INTEGER DEFAULT 50
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH revisions_to_keep AS (
    SELECT id
    FROM document_revisions
    WHERE document_id = p_document_id
    ORDER BY revision_number DESC
    LIMIT p_keep_count
  )
  DELETE FROM document_revisions
  WHERE document_id = p_document_id
  AND id NOT IN (SELECT id FROM revisions_to_keep);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_revisions IS 'Removes old revisions, keeping only the most recent N';

-- =====================================================
-- 7. REALTIME PUBLICATION
-- =====================================================

DO $$
BEGIN
  -- Add tables to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE document_revisions;
    RAISE NOTICE '✅ Added document_revisions to realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ document_revisions already in realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chart_exports;
    RAISE NOTICE '✅ Added chart_exports to realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ chart_exports already in realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE humanizer_logs;
    RAISE NOTICE '✅ Added humanizer_logs to realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ humanizer_logs already in realtime';
  END;
END $$;

-- =====================================================
-- 8. STORAGE BUCKETS (Run via Supabase Dashboard)
-- =====================================================

-- NOTE: Create these buckets in Supabase Dashboard > Storage
-- Or use Supabase CLI:
-- supabase storage create chart-exports --public
-- supabase storage create paper-pdfs --private

-- For reference, the bucket policies should be:

-- chart-exports (public read):
-- INSERT policy: Authenticated users only
-- SELECT policy: Public (or workspace members only)

-- paper-pdfs (private):
-- INSERT policy: Authenticated users only
-- SELECT policy: Authenticated users only (or workspace members)

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ DATABASE MIGRATION COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Tables:';
  RAISE NOTICE '  - document_revisions (with diff support)';
  RAISE NOTICE '  - papers (metadata cache)';
  RAISE NOTICE '  - chart_exports (visualization storage)';
  RAISE NOTICE '  - humanizer_logs (AI usage tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Functions:';
  RAISE NOTICE '  - create_revision_snapshot()';
  RAISE NOTICE '  - cleanup_old_revisions()';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Create Storage buckets (chart-exports, paper-pdfs)';
  RAISE NOTICE '2. Run integration tests: npm test';
  RAISE NOTICE '3. Start backend: npm start';
  RAISE NOTICE '4. Start Redis: redis-server';
  RAISE NOTICE '';
END $$;
