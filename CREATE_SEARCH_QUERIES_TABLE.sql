-- Create search_queries table for analytics
CREATE TABLE IF NOT EXISTS search_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  query_text TEXT NOT NULL,
  search_mode TEXT NOT NULL DEFAULT 'semantic',
  results_count INTEGER DEFAULT 0,
  filter_year INTEGER,
  filter_author TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_search_queries_user ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_namespace ON search_queries(namespace);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_search_mode ON search_queries(search_mode);

-- Enable RLS
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own search queries" ON search_queries;
DROP POLICY IF EXISTS "Users can insert their own search queries" ON search_queries;
DROP POLICY IF EXISTS "Anonymous users can insert search queries" ON search_queries;

CREATE POLICY "Users can view their own search queries"
ON search_queries FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own search queries"
ON search_queries FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anonymous users can insert search queries"
ON search_queries FOR INSERT
WITH CHECK (user_id IS NULL);

-- Grant permissions
GRANT ALL ON search_queries TO authenticated;
GRANT INSERT ON search_queries TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
