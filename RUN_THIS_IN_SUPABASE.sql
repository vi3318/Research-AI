-- ============================================
-- CREATE NOTES TABLE - RUN THIS IN SUPABASE
-- ============================================
-- Copy this entire file and paste it into:
-- Supabase Dashboard > SQL Editor > New Query
-- Then click "Run" button
-- ============================================

-- 1. Create the notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content JSONB NOT NULL DEFAULT '{}',
  content_text TEXT,
  author_id TEXT NOT NULL,
  last_edited_by TEXT,
  version_number INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_author ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

-- 3. Create notes_history table for version control
CREATE TABLE IF NOT EXISTS notes_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  content_diff JSONB,
  author_id TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_notes_history_note ON notes_history(note_id);

-- 4. Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_history ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for notes

-- Allow users to view notes in workspaces they're members of
CREATE POLICY "Users can view notes in their workspaces" ON notes
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to create notes in workspaces they're members of
CREATE POLICY "Users can create notes in their workspaces" ON notes
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to update notes in their workspaces
CREATE POLICY "Users can update notes in their workspaces" ON notes
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text
    )
  );

-- Allow users to delete their own notes or admins to delete any
CREATE POLICY "Users can delete their own notes or admins can delete" ON notes
  FOR DELETE USING (
    author_id = auth.uid()::text OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text AND role IN ('owner', 'admin')
    )
  );

-- 6. Create RLS policies for notes_history

CREATE POLICY "Users can view history of notes in their workspaces" ON notes_history
  FOR SELECT USING (
    note_id IN (
      SELECT id FROM notes WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can insert history" ON notes_history
  FOR INSERT WITH CHECK (true);

-- Done! Table created successfully.
