-- =========================================
-- COLLABORATIVE RESEARCH PLATFORM SCHEMA
-- Enhanced database schema for collaborative workspaces
-- =========================================

-- 1. WORKSPACES - Collaborative research environments
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}', -- Privacy, permissions, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexing for performance
  INDEX idx_workspaces_owner (owner_id),
  INDEX idx_workspaces_created (created_at)
);

-- 2. WORKSPACE MEMBERS - User permissions in workspaces  
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member')),
  permissions JSONB DEFAULT '{}', -- Custom permissions
  invited_by TEXT REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate memberships
  UNIQUE(workspace_id, user_id),
  INDEX idx_workspace_users_workspace (workspace_id),
  INDEX idx_workspace_users_user (user_id)
);

-- 3. COLLABORATIVE NOTES - Real-time shared documents
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content JSONB NOT NULL DEFAULT '{}', -- Rich text content (Draft.js/TipTap format)
  content_text TEXT, -- Plain text version for search
  author_id TEXT NOT NULL REFERENCES users(id),
  last_edited_by TEXT REFERENCES users(id),
  version_number INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_notes_workspace (workspace_id),
  INDEX idx_notes_author (author_id),
  INDEX idx_notes_updated (updated_at),
  INDEX idx_notes_search gin(content_text gin_trgm_ops) -- Full-text search
);

-- 4. NOTES HISTORY - Version control for collaborative editing
CREATE TABLE IF NOT EXISTS notes_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL, -- Snapshot of content at this version
  content_diff JSONB, -- Delta changes from previous version
  author_id TEXT NOT NULL REFERENCES users(id),
  change_summary TEXT, -- Brief description of changes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(note_id, version_number),
  INDEX idx_notes_history_note (note_id),
  INDEX idx_notes_history_version (note_id, version_number)
);

-- 5. PINNED PAPERS - Research papers saved to workspaces
CREATE TABLE IF NOT EXISTS workspace_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL, -- DOI, ArXiv ID, or unique identifier
  title TEXT NOT NULL,
  authors TEXT[],
  abstract TEXT,
  publication_year INTEGER,
  journal TEXT,
  citation_count INTEGER DEFAULT 0,
  keywords TEXT[],
  pdf_url TEXT,
  paper_url TEXT,
  pinned_by TEXT NOT NULL REFERENCES users(id),
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT, -- User notes about this paper
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  
  UNIQUE(workspace_id, paper_id),
  INDEX idx_workspace_papers_workspace (workspace_id),
  INDEX idx_workspace_papers_year (publication_year),
  INDEX idx_workspace_papers_keywords gin(keywords)
);

-- 6. VISUAL ANALYTICS DATA - Chart configurations and cached data
CREATE TABLE IF NOT EXISTS analytics_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL CHECK (chart_type IN ('citation_trends', 'keyword_network', 'paper_comparison', 'collaboration_graph')),
  title TEXT NOT NULL,
  configuration JSONB NOT NULL, -- Chart settings, filters, etc.
  data_cache JSONB, -- Cached chart data for performance
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_analytics_workspace (workspace_id),
  INDEX idx_analytics_type (chart_type)
);

-- 7. RESEARCH DOCUMENTS - Advanced document editor
CREATE TABLE IF NOT EXISTS research_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content JSONB NOT NULL DEFAULT '{}', -- Rich document content
  document_type TEXT DEFAULT 'research_paper' CHECK (document_type IN ('research_paper', 'literature_review', 'proposal', 'notes')),
  template_id UUID, -- Reference to document templates
  citations JSONB DEFAULT '[]', -- Embedded citations [@paper-id]
  bibliography JSONB DEFAULT '[]', -- Auto-generated bibliography
  author_id TEXT NOT NULL REFERENCES users(id),
  collaborators TEXT[] DEFAULT '{}', -- Other users with edit access
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  word_count INTEGER DEFAULT 0,
  version_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_documents_workspace (workspace_id),
  INDEX idx_documents_author (author_id),
  INDEX idx_documents_status (status)
);

-- 8. DOCUMENT VERSIONS - Version control for research documents
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  change_summary TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, version_number),
  INDEX idx_document_versions_doc (document_id)
);

-- 9. WORKSPACE ACTIVITY - Activity feed for collaboration
CREATE TABLE IF NOT EXISTS workspace_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note_created', 'note_edited', 'paper_pinned', 'chart_created', 'document_created', 'member_joined')),
  target_id UUID, -- ID of the affected resource (note, paper, etc.)
  target_type TEXT, -- Type of the affected resource
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_activity_workspace (workspace_id),
  INDEX idx_activity_created (created_at),
  INDEX idx_activity_user (user_id)
);

-- 10. KEYWORD EXTRACTION - For analytics and search
CREATE TABLE IF NOT EXISTS extracted_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  context TEXT, -- Surrounding text where keyword appears
  extraction_method TEXT DEFAULT 'tfidf', -- How keyword was extracted
  confidence_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_keywords_paper (paper_id),
  INDEX idx_keywords_keyword (keyword),
  INDEX idx_keywords_frequency (frequency DESC)
);

-- =========================================
-- PERFORMANCE OPTIMIZATIONS
-- =========================================

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace access control
CREATE POLICY "Users can view workspaces they're members of" ON workspaces
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT user_id FROM workspace_users WHERE workspace_id = id
    ) OR owner_id = auth.uid()::text
  );

CREATE POLICY "Only owners can update workspaces" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can view workspace content they have access to" ON notes
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
    )
  );

-- Materialized views for analytics performance
CREATE MATERIALIZED VIEW workspace_stats AS
  SELECT 
    w.id as workspace_id,
    w.name,
    COUNT(DISTINCT wu.user_id) as member_count,
    COUNT(DISTINCT n.id) as note_count,
    COUNT(DISTINCT wp.id) as paper_count,
    COUNT(DISTINCT rd.id) as document_count,
    MAX(wa.created_at) as last_activity
  FROM workspaces w
  LEFT JOIN workspace_users wu ON w.id = wu.workspace_id
  LEFT JOIN notes n ON w.id = n.workspace_id
  LEFT JOIN workspace_papers wp ON w.id = wp.workspace_id  
  LEFT JOIN research_documents rd ON w.id = rd.workspace_id
  LEFT JOIN workspace_activity wa ON w.id = wa.workspace_id
  GROUP BY w.id, w.name;

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_workspace_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW workspace_stats;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- TRIGGER FUNCTIONS FOR AUTO-UPDATES
-- =========================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON research_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create notes history on updates
CREATE OR REPLACE FUNCTION create_notes_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history if content actually changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO notes_history (
      note_id, 
      version_number, 
      content, 
      author_id,
      change_summary
    ) VALUES (
      NEW.id,
      NEW.version_number,
      OLD.content,
      NEW.last_edited_by,
      'Auto-saved version'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_history_trigger AFTER UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION create_notes_history();

-- Auto-increment version numbers
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.version_number = OLD.version_number + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_notes_version BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION increment_version();

-- =========================================
-- INITIAL DATA & INDEXES
-- =========================================

-- Additional indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_content_gin ON notes USING gin(content);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_papers_keywords_gin ON workspace_papers USING gin(keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_composite ON workspace_activity(workspace_id, created_at DESC);

-- Full-text search extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Search index for notes content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_fulltext ON notes USING gin(content_text gin_trgm_ops);

COMMENT ON TABLE workspaces IS 'Collaborative research workspaces';
COMMENT ON TABLE workspace_users IS 'Workspace membership and permissions';
COMMENT ON TABLE notes IS 'Collaborative notes with real-time editing';
COMMENT ON TABLE notes_history IS 'Version history for collaborative notes';
COMMENT ON TABLE workspace_papers IS 'Research papers pinned to workspaces';
COMMENT ON TABLE analytics_charts IS 'Visual analytics configurations';
COMMENT ON TABLE research_documents IS 'Advanced research document editor';
COMMENT ON TABLE workspace_activity IS 'Activity feed for workspace collaboration';
