-- Create notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content JSONB NOT NULL DEFAULT '{}',
  content_text TEXT,
  author_id TEXT NOT NULL REFERENCES auth.users(id),
  last_edited_by TEXT REFERENCES auth.users(id),
  version_number INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_author ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

-- Create notes_history table
CREATE TABLE IF NOT EXISTS notes_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  content_diff JSONB,
  author_id TEXT NOT NULL REFERENCES auth.users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(note_id, version_number)
);

-- Create indexes for notes_history
CREATE INDEX IF NOT EXISTS idx_notes_history_note ON notes_history(note_id);
CREATE INDEX IF NOT EXISTS idx_notes_history_version ON notes_history(note_id, version_number);

-- Enable RLS (Row Level Security)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notes
CREATE POLICY "Users can view notes in their workspaces" ON notes
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create notes in their workspaces" ON notes
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update notes in their workspaces" ON notes
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (
    author_id = auth.uid()::text OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid()::text AND role IN ('owner', 'admin')
    )
  );

-- Create RLS policies for notes_history
CREATE POLICY "Users can view history of notes in their workspaces" ON notes_history
  FOR SELECT USING (
    note_id IN (
      SELECT id FROM notes WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "System can insert history" ON notes_history
  FOR INSERT WITH CHECK (true);
