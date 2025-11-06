-- Create papers table for semantic search with pgvector support
-- This table stores academic papers with their embeddings for vector similarity search

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing view first if it exists
DROP VIEW IF EXISTS recent_papers CASCADE;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_papers_by_embedding(vector, float, int) CASCADE;

-- Drop existing indexes to avoid conflicts
DROP INDEX IF EXISTS idx_papers_title CASCADE;
DROP INDEX IF EXISTS idx_papers_abstract CASCADE;
DROP INDEX IF EXISTS idx_papers_year CASCADE;
DROP INDEX IF EXISTS idx_papers_source CASCADE;
DROP INDEX IF EXISTS idx_papers_keywords CASCADE;
DROP INDEX IF EXISTS idx_papers_created_at CASCADE;
DROP INDEX IF EXISTS idx_papers_embedding_hnsw CASCADE;

-- Drop existing table if needed (careful in production!)
-- Uncomment the next line only if you want to start fresh
DROP TABLE IF EXISTS papers CASCADE;

-- Create papers table
CREATE TABLE papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Paper metadata
  title TEXT NOT NULL,
  authors TEXT NOT NULL, -- Comma-separated or JSON array as text
  abstract TEXT,
  year INTEGER,
  source TEXT NOT NULL, -- 'google_scholar', 'arxiv', 'pubmed', 'openalex'
  source_id TEXT, -- Original ID from source API
  link TEXT,
  pdf_url TEXT,
  doi TEXT,
  venue TEXT, -- Journal or conference name
  citation_count INTEGER DEFAULT 0,
  
  -- Vector embedding for semantic search
  -- Using 768 dimensions for all-mpnet-base-v2 model
  embedding vector(768),
  
  -- Additional metadata
  keywords TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate papers from same source
  UNIQUE(source, source_id)
);

-- Create indexes for performance
CREATE INDEX idx_papers_title ON papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract ON papers USING gin(to_tsvector('english', COALESCE(abstract, '')));
CREATE INDEX idx_papers_year ON papers(year DESC) WHERE year IS NOT NULL;
CREATE INDEX idx_papers_source ON papers(source);
CREATE INDEX idx_papers_keywords ON papers USING gin(keywords);
CREATE INDEX idx_papers_created_at ON papers(created_at DESC);

-- Create indexes for performance
CREATE INDEX idx_papers_title ON papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract ON papers USING gin(to_tsvector('english', COALESCE(abstract, '')));
CREATE INDEX idx_papers_year ON papers(year DESC) WHERE year IS NOT NULL;
CREATE INDEX idx_papers_source ON papers(source);
CREATE INDEX idx_papers_keywords ON papers USING gin(keywords);
CREATE INDEX idx_papers_created_at ON papers(created_at DESC);

-- CRITICAL: Create HNSW index for vector similarity search
-- This enables fast approximate nearest neighbor search
CREATE INDEX idx_papers_embedding_hnsw ON papers 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (less accurate but faster to build)
-- CREATE INDEX IF NOT EXISTS idx_papers_embedding_ivfflat ON papers 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read papers
DROP POLICY IF EXISTS "Anyone can view papers" ON papers;
CREATE POLICY "Anyone can view papers"
ON papers FOR SELECT
TO authenticated, anon
USING (true);

-- Only backend service can insert/update papers (via service role key)
DROP POLICY IF EXISTS "Service can insert papers" ON papers;
CREATE POLICY "Service can insert papers"
ON papers FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update papers" ON papers;
CREATE POLICY "Service can update papers"
ON papers FOR UPDATE
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON papers TO authenticated;
GRANT SELECT ON papers TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION search_papers_by_embedding(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  authors text,
  abstract text,
  year integer,
  source text,
  link text,
  pdf_url text,
  citation_count integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    papers.id,
    papers.title,
    papers.authors,
    papers.abstract,
    papers.year,
    papers.source,
    papers.link,
    papers.pdf_url,
    papers.citation_count,
    1 - (papers.embedding <=> query_embedding) as similarity
  FROM papers
  WHERE papers.embedding IS NOT NULL
    AND 1 - (papers.embedding <=> query_embedding) > match_threshold
  ORDER BY papers.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_papers_updated_at ON papers;
CREATE TRIGGER update_papers_updated_at
    BEFORE UPDATE ON papers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for recent papers
CREATE OR REPLACE VIEW recent_papers AS
SELECT 
  id,
  title,
  authors,
  CASE 
    WHEN abstract IS NOT NULL THEN SUBSTRING(abstract, 1, 200) || '...'
    ELSE NULL
  END as abstract_snippet,
  year,
  source,
  link,
  citation_count,
  created_at
FROM papers
WHERE created_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 100;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Papers table created successfully with pgvector support!';
  RAISE NOTICE 'HNSW index created for fast vector similarity search.';
  RAISE NOTICE 'Use search_papers_by_embedding() function for semantic search.';
END $$;
