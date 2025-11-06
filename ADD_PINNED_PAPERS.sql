-- Add pinned papers functionality
-- The workspace_papers table already exists, this ensures it has all needed columns

-- Ensure workspace_papers table exists with all columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_papers') THEN
    CREATE TABLE workspace_papers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      paper_id TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT[],
      abstract TEXT,
      publication_year INTEGER,
      journal TEXT,
      venue TEXT,
      citation_count INTEGER DEFAULT 0,
      keywords TEXT[],
      pdf_url TEXT,
      paper_url TEXT,
      pinned_by UUID NOT NULL REFERENCES auth.users(id),
      pinned_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      tags TEXT[],
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(workspace_id, paper_id)
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_workspace_papers_workspace ON workspace_papers(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_papers_year ON workspace_papers(publication_year);
    CREATE INDEX IF NOT EXISTS idx_workspace_papers_keywords ON workspace_papers USING gin(keywords);
    CREATE INDEX IF NOT EXISTS idx_workspace_papers_pinned_by ON workspace_papers(pinned_by);
  END IF;
END $$;

-- Add venue column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_papers' AND column_name = 'venue'
  ) THEN
    ALTER TABLE workspace_papers ADD COLUMN venue TEXT;
  END IF;
END $$;

-- Add created_at/updated_at if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_papers' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE workspace_papers ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_papers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE workspace_papers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE workspace_papers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view papers in their workspaces" ON workspace_papers;
DROP POLICY IF EXISTS "Users can pin papers to their workspaces" ON workspace_papers;
DROP POLICY IF EXISTS "Users can update papers they pinned" ON workspace_papers;
DROP POLICY IF EXISTS "Users can delete papers they pinned" ON workspace_papers;

-- Create RLS policies
CREATE POLICY "Users can view papers in their workspaces"
ON workspace_papers FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_collaborators 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can pin papers to their workspaces"
ON workspace_papers FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_collaborators 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update papers they pinned"
ON workspace_papers FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_collaborators 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete papers they pinned"
ON workspace_papers FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_collaborators 
    WHERE user_id = auth.uid()
  )
);

-- Grant permissions
GRANT ALL ON workspace_papers TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
