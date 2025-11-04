-- =====================================================
-- COLLABORATIVE DOCUMENTS SCHEMA FOR RESEARCHAI
-- Google Docs-style real-time collaborative editing
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DOCUMENTS TABLE
-- Stores document metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  type TEXT NOT NULL CHECK (type IN ('ieee', 'blank')),
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by UUID,
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX idx_documents_type ON documents(type);

-- =====================================================
-- 2. DOCUMENT_CONTENT TABLE
-- Stores actual document content (Y.js state)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  yjs_state BYTEA, -- Y.js encoded state for CRDT
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Index for quick document lookup
CREATE INDEX idx_document_content_doc_id ON document_content(document_id);

-- =====================================================
-- 3. WORKSPACE_COLLABORATORS TABLE
-- Manages document access and permissions
-- =====================================================
CREATE TABLE IF NOT EXISTS workspace_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'commenter')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID,
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(workspace_id, user_id)
);

-- Indexes
CREATE INDEX idx_collaborators_workspace ON workspace_collaborators(workspace_id);
CREATE INDEX idx_collaborators_user ON workspace_collaborators(user_id);

-- =====================================================
-- 4. DOCUMENT_COLLABORATORS TABLE
-- Document-level permissions (finer granularity)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'commenter')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID,
  UNIQUE(document_id, user_id)
);

CREATE INDEX idx_doc_collaborators_document ON document_collaborators(document_id);
CREATE INDEX idx_doc_collaborators_user ON document_collaborators(user_id);

-- =====================================================
-- 5. DOCUMENT_REVISIONS TABLE
-- Version history snapshots
-- =====================================================
CREATE TABLE IF NOT EXISTS document_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  change_summary TEXT,
  UNIQUE(document_id, revision_number)
);

-- Indexes
CREATE INDEX idx_revisions_document ON document_revisions(document_id, revision_number DESC);
CREATE INDEX idx_revisions_created ON document_revisions(created_at DESC);

-- =====================================================
-- 6. DOCUMENT_PRESENCE TABLE
-- Track active users and their cursors
-- =====================================================
CREATE TABLE IF NOT EXISTS document_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  cursor_position INTEGER,
  selection_start INTEGER,
  selection_end INTEGER,
  color TEXT, -- Hex color for cursor
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX idx_presence_document ON document_presence(document_id);

-- Auto-cleanup old presence (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM document_presence
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_presence
AFTER INSERT ON document_presence
EXECUTE FUNCTION cleanup_old_presence();

-- =====================================================
-- 7. DOCUMENT_COMMENTS TABLE
-- Inline comments and suggestions
-- =====================================================
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  content TEXT NOT NULL,
  position_start INTEGER,
  position_end INTEGER,
  resolved BOOLEAN DEFAULT FALSE,
  parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_document ON document_comments(document_id);
CREATE INDEX idx_comments_parent ON document_comments(parent_comment_id);

-- =====================================================
-- 8. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_content_updated_at
BEFORE UPDATE ON document_content
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Documents: Users can see documents they own or are collaborators on
CREATE POLICY "Users can view their documents"
ON documents FOR SELECT
USING (
  owner_id = auth.uid() OR
  id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own documents"
ON documents FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and editors can update documents"
ON documents FOR UPDATE
USING (
  owner_id = auth.uid() OR
  id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Owners can delete documents"
ON documents FOR DELETE
USING (owner_id = auth.uid());

-- Document Content: Match document access
CREATE POLICY "Users can view content of accessible documents"
ON document_content FOR SELECT
USING (
  document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid()) OR
  document_id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert content for their documents"
ON document_content FOR INSERT
WITH CHECK (
  document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
);

CREATE POLICY "Editors can update content"
ON document_content FOR UPDATE
USING (
  document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid()) OR
  document_id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

-- Collaborators: Can view workspace collaborators if member
CREATE POLICY "Members can view workspace collaborators"
ON workspace_collaborators FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Document Collaborators: Can view if has access to document
CREATE POLICY "Users can view document collaborators"
ON document_collaborators FOR SELECT
USING (
  document_id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid()
  ) OR
  document_id IN (
    SELECT id FROM documents WHERE owner_id = auth.uid()
  )
);

-- Presence: Anyone with document access can see/update presence
CREATE POLICY "Users can manage presence for accessible documents"
ON document_presence FOR ALL
USING (
  document_id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid()
  ) OR
  document_id IN (
    SELECT id FROM documents WHERE owner_id = auth.uid()
  )
);

-- Comments: Can view/add comments if has access
CREATE POLICY "Users can view comments on accessible documents"
ON document_comments FOR SELECT
USING (
  document_id IN (
    SELECT document_id FROM document_collaborators
    WHERE user_id = auth.uid()
  ) OR
  document_id IN (
    SELECT id FROM documents WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can add comments to accessible documents"
ON document_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND (
    document_id IN (
      SELECT document_id FROM document_collaborators
      WHERE user_id = auth.uid()
    ) OR
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  )
);

-- =====================================================
-- 10. ENABLE REALTIME FOR COLLABORATION
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE document_content;
ALTER PUBLICATION supabase_realtime ADD TABLE document_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE document_comments;

-- =====================================================
-- 11. HELPER FUNCTIONS
-- =====================================================

-- Function to create a new document with default content
CREATE OR REPLACE FUNCTION create_document(
  p_workspace_id UUID,
  p_title TEXT,
  p_type TEXT,
  p_owner_id UUID,
  p_initial_content JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_document_id UUID;
BEGIN
  -- Insert document
  INSERT INTO documents (workspace_id, title, type, owner_id)
  VALUES (p_workspace_id, p_title, p_type, p_owner_id)
  RETURNING id INTO v_document_id;
  
  -- Insert initial content
  INSERT INTO document_content (document_id, content)
  VALUES (v_document_id, p_initial_content);
  
  -- Add owner as collaborator
  INSERT INTO document_collaborators (document_id, user_id, role, added_by)
  VALUES (v_document_id, p_owner_id, 'owner', p_owner_id);
  
  RETURN v_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add collaborator
CREATE OR REPLACE FUNCTION add_document_collaborator(
  p_document_id UUID,
  p_user_id UUID,
  p_role TEXT,
  p_added_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO document_collaborators (document_id, user_id, role, added_by)
  VALUES (p_document_id, p_user_id, p_role, p_added_by)
  ON CONFLICT (document_id, user_id)
  DO UPDATE SET role = p_role;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create revision snapshot
CREATE OR REPLACE FUNCTION create_revision_snapshot(
  p_document_id UUID,
  p_created_by UUID,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_revision_id UUID;
  v_next_revision_number INTEGER;
  v_current_content JSONB;
BEGIN
  -- Get next revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1
  INTO v_next_revision_number
  FROM document_revisions
  WHERE document_id = p_document_id;
  
  -- Get current content
  SELECT content INTO v_current_content
  FROM document_content
  WHERE document_id = p_document_id;
  
  -- Create revision
  INSERT INTO document_revisions (
    document_id,
    revision_number,
    content_snapshot,
    created_by,
    change_summary
  )
  VALUES (
    p_document_id,
    v_next_revision_number,
    v_current_content,
    p_created_by,
    p_change_summary
  )
  RETURNING id INTO v_revision_id;
  
  RETURN v_revision_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Note: Uncomment below to insert sample data

/*
-- Insert sample workspace (if not exists)
INSERT INTO workspaces (id, name, description, created_by)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Sample Research Workspace',
  'Collaborative research workspace for testing',
  auth.uid()
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample IEEE document
SELECT create_document(
  'a0000000-0000-0000-0000-000000000001',
  'IEEE Research Paper Template',
  'ieee',
  auth.uid(),
  '{"type": "doc", "content": []}'::jsonb
);
*/

-- =====================================================
-- END OF SCHEMA
-- =====================================================
