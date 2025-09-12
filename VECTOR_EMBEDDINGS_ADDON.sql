-- Vector Embeddings Add-on for ResearchAI
-- Run this AFTER enabling the pgvector extension and running the main schema

-- ==============================================
-- VECTOR EMBEDDINGS TABLES
-- ==============================================

-- Create paper_embeddings table for vector search
CREATE TABLE IF NOT EXISTS paper_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  
  -- Embeddings for different models and purposes
  title_embedding VECTOR(384), -- Sentence transformer embeddings (all-MiniLM-L6-v2)
  abstract_embedding VECTOR(384), -- Sentence transformer embeddings
  full_text_embedding VECTOR(1536), -- OpenAI text-embedding-ada-002
  keywords_embedding VECTOR(384), -- Keywords semantic embedding
  
  -- Embedding metadata
  embedding_model TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
  openai_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_version TEXT DEFAULT '1.0',
  
  -- Processing flags
  title_processed BOOLEAN DEFAULT FALSE,
  abstract_processed BOOLEAN DEFAULT FALSE,
  full_text_processed BOOLEAN DEFAULT FALSE,
  keywords_processed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(paper_id, embedding_model)
);

-- Create search_embeddings table for caching query embeddings
CREATE TABLE IF NOT EXISTS search_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE, -- MD5 hash for deduplication
  
  -- Query embeddings
  query_embedding VECTOR(384), -- Sentence transformer embedding
  openai_embedding VECTOR(1536), -- OpenAI embedding
  
  -- Metadata
  embedding_model TEXT NOT NULL DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cache expiry
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- VECTOR SIMILARITY INDEXES
-- ==============================================

-- Vector similarity indexes for paper embeddings (using cosine similarity)
CREATE INDEX IF NOT EXISTS idx_paper_embeddings_title_cosine 
ON paper_embeddings USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_paper_embeddings_abstract_cosine 
ON paper_embeddings USING ivfflat (abstract_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_paper_embeddings_keywords_cosine 
ON paper_embeddings USING ivfflat (keywords_embedding vector_cosine_ops) WITH (lists = 100);

-- Vector similarity indexes for search embeddings
CREATE INDEX IF NOT EXISTS idx_search_embeddings_query_cosine 
ON search_embeddings USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 50);

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_paper_embeddings_paper_id ON paper_embeddings(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_embeddings_model ON paper_embeddings(embedding_model);
CREATE INDEX IF NOT EXISTS idx_search_embeddings_hash ON search_embeddings(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_embeddings_expires ON search_embeddings(expires_at);

-- ==============================================
-- VECTOR SEARCH FUNCTIONS
-- ==============================================

-- Function to find similar papers using vector similarity
CREATE OR REPLACE FUNCTION find_similar_papers(
    query_embedding VECTOR(384),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20,
    search_field TEXT DEFAULT 'title' -- 'title', 'abstract', 'keywords'
)
RETURNS TABLE(
    paper_id UUID,
    similarity_score FLOAT,
    title TEXT,
    authors TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as paper_id,
        CASE 
            WHEN search_field = 'title' THEN 1 - (pe.title_embedding <=> query_embedding)
            WHEN search_field = 'abstract' THEN 1 - (pe.abstract_embedding <=> query_embedding)
            WHEN search_field = 'keywords' THEN 1 - (pe.keywords_embedding <=> query_embedding)
            ELSE 1 - (pe.title_embedding <=> query_embedding)
        END as similarity_score,
        p.title,
        array_to_string(
            array_agg(DISTINCT a.name ORDER BY pa.author_order), 
            ', '
        ) as authors
    FROM paper_embeddings pe
    JOIN papers p ON pe.paper_id = p.id
    LEFT JOIN paper_authors pa ON p.id = pa.paper_id
    LEFT JOIN authors a ON pa.author_id = a.id
    WHERE 
        CASE 
            WHEN search_field = 'title' THEN 
                pe.title_embedding IS NOT NULL AND 
                (1 - (pe.title_embedding <=> query_embedding)) >= similarity_threshold
            WHEN search_field = 'abstract' THEN 
                pe.abstract_embedding IS NOT NULL AND 
                (1 - (pe.abstract_embedding <=> query_embedding)) >= similarity_threshold
            WHEN search_field = 'keywords' THEN 
                pe.keywords_embedding IS NOT NULL AND 
                (1 - (pe.keywords_embedding <=> query_embedding)) >= similarity_threshold
            ELSE 
                pe.title_embedding IS NOT NULL AND 
                (1 - (pe.title_embedding <=> query_embedding)) >= similarity_threshold
        END
    GROUP BY p.id, pe.title_embedding, pe.abstract_embedding, pe.keywords_embedding, query_embedding, search_field
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find hybrid search results (combining text and vector search)
CREATE OR REPLACE FUNCTION hybrid_paper_search(
    search_query TEXT,
    query_embedding VECTOR(384),
    text_weight FLOAT DEFAULT 0.3,
    vector_weight FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE(
    paper_id UUID,
    combined_score FLOAT,
    text_score FLOAT,
    vector_score FLOAT,
    title TEXT,
    abstract TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH text_search AS (
        SELECT 
            p.id,
            ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')), 
                    plainto_tsquery('english', search_query)) as score
        FROM papers p
        WHERE to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')) 
              @@ plainto_tsquery('english', search_query)
    ),
    vector_search AS (
        SELECT 
            pe.paper_id,
            GREATEST(
                COALESCE(1 - (pe.title_embedding <=> query_embedding), 0),
                COALESCE(1 - (pe.abstract_embedding <=> query_embedding), 0)
            ) as score
        FROM paper_embeddings pe
        WHERE pe.title_embedding IS NOT NULL OR pe.abstract_embedding IS NOT NULL
    )
    SELECT 
        COALESCE(ts.id, vs.paper_id) as paper_id,
        (COALESCE(ts.score, 0) * text_weight + COALESCE(vs.score, 0) * vector_weight) as combined_score,
        COALESCE(ts.score, 0) as text_score,
        COALESCE(vs.score, 0) as vector_score,
        p.title,
        p.abstract
    FROM text_search ts
    FULL OUTER JOIN vector_search vs ON ts.id = vs.paper_id
    JOIN papers p ON p.id = COALESCE(ts.id, vs.paper_id)
    WHERE (ts.score IS NOT NULL AND ts.score > 0.01) 
       OR (vs.score IS NOT NULL AND vs.score > 0.5)
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get or cache query embedding
CREATE OR REPLACE FUNCTION get_cached_query_embedding(
    query_text TEXT,
    embedding_vector VECTOR(384) DEFAULT NULL
)
RETURNS VECTOR(384) AS $$
DECLARE
    cached_embedding VECTOR(384);
    query_hash_val TEXT;
BEGIN
    -- Generate hash for the query
    query_hash_val := md5(lower(trim(query_text)));
    
    -- Try to get cached embedding
    SELECT query_embedding INTO cached_embedding
    FROM search_embeddings
    WHERE query_hash = query_hash_val 
    AND expires_at > NOW();
    
    IF cached_embedding IS NOT NULL THEN
        -- Update usage statistics
        UPDATE search_embeddings 
        SET usage_count = usage_count + 1,
            last_used_at = NOW()
        WHERE query_hash = query_hash_val;
        
        RETURN cached_embedding;
    END IF;
    
    -- If no cached embedding and new embedding provided, cache it
    IF embedding_vector IS NOT NULL THEN
        INSERT INTO search_embeddings (query_text, query_hash, query_embedding)
        VALUES (query_text, query_hash_val, embedding_vector)
        ON CONFLICT (query_hash) DO UPDATE SET
            usage_count = search_embeddings.usage_count + 1,
            last_used_at = NOW(),
            expires_at = NOW() + INTERVAL '30 days';
            
        RETURN embedding_vector;
    END IF;
    
    -- Return NULL if no embedding available
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired search embeddings
CREATE OR REPLACE FUNCTION clean_expired_embeddings()
RETURNS void AS $$
BEGIN
    DELETE FROM search_embeddings WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGERS FOR VECTOR TABLES
-- ==============================================

-- Update trigger for paper_embeddings
DROP TRIGGER IF EXISTS update_paper_embeddings_updated_at ON paper_embeddings;
CREATE TRIGGER update_paper_embeddings_updated_at 
BEFORE UPDATE ON paper_embeddings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY FOR VECTOR TABLES
-- ==============================================

-- Enable RLS on vector tables
ALTER TABLE paper_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_embeddings ENABLE ROW LEVEL SECURITY;

-- Paper embeddings are publicly readable for search functionality
CREATE POLICY "Paper embeddings are publicly readable" ON paper_embeddings FOR SELECT USING (true);
CREATE POLICY "Paper embeddings are publicly insertable" ON paper_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Paper embeddings are publicly updatable" ON paper_embeddings FOR UPDATE USING (true);

-- Search embeddings - users can see their own + system can see all for caching
CREATE POLICY "Search embeddings are publicly readable" ON search_embeddings FOR SELECT USING (true);
CREATE POLICY "Search embeddings are publicly insertable" ON search_embeddings FOR INSERT WITH CHECK (true);

-- ==============================================
-- VECTOR SEARCH PERFORMANCE VIEWS
-- ==============================================

-- View for embedding generation progress
CREATE VIEW embedding_progress AS
SELECT 
    COUNT(*) as total_papers,
    COUNT(*) FILTER (WHERE pe.title_processed) as titles_embedded,
    COUNT(*) FILTER (WHERE pe.abstract_processed) as abstracts_embedded,
    COUNT(*) FILTER (WHERE pe.keywords_processed) as keywords_embedded,
    COUNT(*) FILTER (WHERE pe.full_text_processed) as full_texts_embedded,
    ROUND(
        (COUNT(*) FILTER (WHERE pe.title_processed)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
    ) as title_completion_percent,
    ROUND(
        (COUNT(*) FILTER (WHERE pe.abstract_processed)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
    ) as abstract_completion_percent
FROM papers p
LEFT JOIN paper_embeddings pe ON p.id = pe.paper_id;

-- View for search embedding cache statistics
CREATE VIEW search_cache_stats AS
SELECT 
    COUNT(*) as total_cached_queries,
    SUM(usage_count) as total_cache_hits,
    AVG(usage_count) as avg_usage_per_query,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as active_cache_entries,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries
FROM search_embeddings;
