-- Enhanced Database Schema for ResearchAI with Citation and Performance Optimizations
-- This file extends the existing database schema with new tables and optimizations
-- (Removed vector embeddings - can be added later with pgvector extension)

-- ==============================================
-- PAPERS AND CITATION MANAGEMENT TABLES
-- ==============================================

-- Create papers table for storing paper metadata (normalized storage)
CREATE TABLE IF NOT EXISTS papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT UNIQUE, -- Digital Object Identifier
  arxiv_id TEXT, -- ArXiv identifier
  pubmed_id TEXT, -- PubMed identifier
  openalex_id TEXT, -- OpenAlex identifier
  
  -- Core metadata
  title TEXT NOT NULL,
  abstract TEXT,
  publication_year INTEGER,
  publication_date DATE,
  
  -- Publication details
  journal TEXT,
  venue TEXT, -- Conference or journal name
  volume TEXT,
  issue TEXT,
  pages TEXT,
  publisher TEXT,
  
  -- Metrics
  citation_count INTEGER DEFAULT 0,
  h_index FLOAT,
  influence_score FLOAT,
  
  -- Access information
  is_open_access BOOLEAN DEFAULT FALSE,
  oa_host_type TEXT, -- repository, publisher, etc.
  pdf_url TEXT,
  paper_url TEXT,
  
  -- Search and classification
  categories TEXT[], -- Subject categories
  keywords TEXT[], -- Extracted keywords
  language TEXT DEFAULT 'en',
  
  -- Full text processing
  full_text_processed BOOLEAN DEFAULT FALSE,
  embeddings_generated BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  source_databases TEXT[], -- ['scholar', 'arxiv', 'pubmed', etc.]
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create authors table for normalized author storage
CREATE TABLE IF NOT EXISTS authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT, -- For matching variations
  email TEXT,
  affiliation TEXT,
  orcid TEXT, -- ORCID identifier
  h_index INTEGER,
  total_citations INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create paper_authors junction table
CREATE TABLE IF NOT EXISTS paper_authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  author_order INTEGER NOT NULL, -- Order of authorship
  is_corresponding BOOLEAN DEFAULT FALSE,
  affiliation_at_time TEXT, -- Affiliation when paper was written
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(paper_id, author_id)
);

-- Create citations table for storing generated citations
CREATE TABLE IF NOT EXISTS citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Citation content
  style TEXT NOT NULL CHECK (style IN ('apa', 'mla', 'chicago', 'ieee', 'harvard', 'bibtex', 'vancouver')),
  citation_text TEXT NOT NULL,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexing
  UNIQUE(paper_id, style)
);

-- Create search_results table for caching search results
CREATE TABLE IF NOT EXISTS search_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  
  -- Search parameters
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL, -- MD5 hash of normalized query
  sources TEXT[], -- ['scholar', 'arxiv', 'pubmed', etc.]
  filters JSONB DEFAULT '{}',
  
  -- Results
  papers_found UUID[], -- Array of paper IDs
  total_results INTEGER,
  relevance_scores JSONB, -- Map of paper_id -> relevance_score
  
  -- Performance tracking
  search_duration_ms INTEGER,
  
  -- Caching
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_preferences table for citation and search preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Citation preferences
  default_citation_style TEXT DEFAULT 'apa' CHECK (default_citation_style IN ('apa', 'mla', 'chicago', 'ieee', 'harvard', 'bibtex', 'vancouver')),
  citation_settings JSONB DEFAULT '{}',
  
  -- Search preferences
  default_sources TEXT[] DEFAULT ARRAY['scholar', 'arxiv', 'pubmed'],
  max_results INTEGER DEFAULT 20,
  search_settings JSONB DEFAULT '{}',
  
  -- UI preferences
  ui_preferences JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ==============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ==============================================

-- Papers table indexes
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_arxiv_id ON papers(arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_title_gin ON papers USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_papers_abstract_gin ON papers USING gin(to_tsvector('english', abstract));
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(publication_year);
CREATE INDEX IF NOT EXISTS idx_papers_journal ON papers(journal);
CREATE INDEX IF NOT EXISTS idx_papers_citation_count ON papers(citation_count DESC);
CREATE INDEX IF NOT EXISTS idx_papers_categories ON papers USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_papers_keywords ON papers USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_papers_sources ON papers USING gin(source_databases);
CREATE INDEX IF NOT EXISTS idx_papers_open_access ON papers(is_open_access) WHERE is_open_access = TRUE;

-- Authors table indexes
CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name);
CREATE INDEX IF NOT EXISTS idx_authors_normalized_name ON authors(normalized_name);
CREATE INDEX IF NOT EXISTS idx_authors_orcid ON authors(orcid) WHERE orcid IS NOT NULL;

-- Paper authors indexes
CREATE INDEX IF NOT EXISTS idx_paper_authors_paper_id ON paper_authors(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_authors_author_id ON paper_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_paper_authors_order ON paper_authors(paper_id, author_order);

-- Citations table indexes
CREATE INDEX IF NOT EXISTS idx_citations_paper_id ON citations(paper_id);
CREATE INDEX IF NOT EXISTS idx_citations_user_id ON citations(user_id);
CREATE INDEX IF NOT EXISTS idx_citations_style ON citations(style);
CREATE INDEX IF NOT EXISTS idx_citations_usage ON citations(usage_count DESC);

-- Search results indexes
CREATE INDEX IF NOT EXISTS idx_search_results_query_hash ON search_results(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_results_user_id ON search_results(user_id);
CREATE INDEX IF NOT EXISTS idx_search_results_expires ON search_results(expires_at);

-- ==============================================
-- TRIGGERS AND FUNCTIONS
-- ==============================================

-- Function to update citation usage
CREATE OR REPLACE FUNCTION update_citation_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE citations 
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE paper_id = NEW.paper_id AND style = NEW.style;
  
  IF NOT FOUND THEN
    -- Insert new citation record
    INSERT INTO citations (paper_id, user_id, style, citation_text)
    VALUES (NEW.paper_id, NEW.user_id, NEW.style, NEW.citation_text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired search results
CREATE OR REPLACE FUNCTION clean_expired_search_results()
RETURNS void AS $$
BEGIN
  DELETE FROM search_results WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to normalize author names for better matching
CREATE OR REPLACE FUNCTION normalize_author_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove titles, normalize spacing, convert to lowercase
  RETURN lower(trim(regexp_replace(name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate citation cache key
CREATE OR REPLACE FUNCTION generate_citation_key(paper_data JSONB, style TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN md5(paper_data::text || style);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================
-- UPDATE TRIGGERS
-- ==============================================

-- Add update triggers for new tables
DROP TRIGGER IF EXISTS update_papers_updated_at ON papers;
CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON papers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_authors_updated_at ON authors;
CREATE TRIGGER update_authors_updated_at BEFORE UPDATE ON authors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Papers are public (no RLS restrictions)
CREATE POLICY "Papers are publicly readable" ON papers FOR SELECT USING (true);
CREATE POLICY "Papers are publicly insertable" ON papers FOR INSERT WITH CHECK (true);
CREATE POLICY "Papers are publicly updatable" ON papers FOR UPDATE USING (true);

-- Authors are public
CREATE POLICY "Authors are publicly readable" ON authors FOR SELECT USING (true);
CREATE POLICY "Authors are publicly insertable" ON authors FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors are publicly updatable" ON authors FOR UPDATE USING (true);

-- Paper authors are public
CREATE POLICY "Paper authors are publicly readable" ON paper_authors FOR SELECT USING (true);
CREATE POLICY "Paper authors are publicly insertable" ON paper_authors FOR INSERT WITH CHECK (true);

-- Citations - users can see all, but only modify their own
CREATE POLICY "Citations are publicly readable" ON citations FOR SELECT USING (true);
CREATE POLICY "Users can insert own citations" ON citations FOR INSERT WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL);
CREATE POLICY "Users can update own citations" ON citations FOR UPDATE USING (user_id = auth.uid()::text);

-- Search results - users can only see their own
CREATE POLICY "Users can view own search results" ON search_results FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL);

-- User preferences - users can only see their own
CREATE POLICY "Users can view own preferences" ON user_preferences FOR ALL USING (user_id = auth.uid()::text);

-- ==============================================
-- PERFORMANCE MONITORING VIEWS
-- ==============================================

-- View for monitoring search performance
CREATE VIEW search_performance_stats AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as searches_count,
  AVG(search_duration_ms) as avg_duration_ms,
  AVG(total_results) as avg_results_count
FROM search_results
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour;

-- View for citation usage stats
CREATE VIEW citation_usage_stats AS
SELECT 
  style,
  COUNT(*) as times_generated,
  SUM(usage_count) as total_usage,
  AVG(usage_count) as avg_usage_per_citation,
  DATE_TRUNC('day', generated_at) as day
FROM citations
WHERE generated_at >= NOW() - INTERVAL '30 days'
GROUP BY style, DATE_TRUNC('day', generated_at)
ORDER BY day, style;
