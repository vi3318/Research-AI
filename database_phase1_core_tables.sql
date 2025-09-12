-- Phase 1: Core Tables for Citation Feature
-- Run this first in Supabase SQL Editor

-- Create papers table
CREATE TABLE IF NOT EXISTS papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT UNIQUE,
  arxiv_id TEXT,
  pubmed_id TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  publication_year INTEGER,
  publication_date DATE,
  journal TEXT,
  venue TEXT,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  publisher TEXT,
  citation_count INTEGER DEFAULT 0,
  is_open_access BOOLEAN DEFAULT FALSE,
  oa_host_type TEXT,
  pdf_url TEXT,
  paper_url TEXT,
  categories TEXT[],
  keywords TEXT[],
  language TEXT DEFAULT 'en',
  source_databases TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create authors table
CREATE TABLE IF NOT EXISTS authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT,
  email TEXT,
  affiliation TEXT,
  orcid TEXT,
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
  author_order INTEGER NOT NULL,
  is_corresponding BOOLEAN DEFAULT FALSE,
  affiliation_at_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paper_id, author_id)
);

-- Create citations table (most important for caching)
CREATE TABLE IF NOT EXISTS citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  style TEXT NOT NULL CHECK (style IN ('apa', 'mla', 'chicago', 'ieee', 'harvard', 'bibtex', 'vancouver')),
  citation_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paper_id, style)
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_title ON papers(title);
CREATE INDEX IF NOT EXISTS idx_citations_paper_style ON citations(paper_id, style);
CREATE INDEX IF NOT EXISTS idx_citations_usage ON citations(usage_count DESC);

-- Enable RLS
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Papers are publicly readable" ON papers FOR SELECT USING (true);
CREATE POLICY "Papers are publicly insertable" ON papers FOR INSERT WITH CHECK (true);
CREATE POLICY "Papers are publicly updatable" ON papers FOR UPDATE USING (true);

CREATE POLICY "Authors are publicly readable" ON authors FOR SELECT USING (true);
CREATE POLICY "Authors are publicly insertable" ON authors FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors are publicly updatable" ON authors FOR UPDATE USING (true);

CREATE POLICY "Paper authors are publicly readable" ON paper_authors FOR SELECT USING (true);
CREATE POLICY "Paper authors are publicly insertable" ON paper_authors FOR INSERT WITH CHECK (true);

CREATE POLICY "Citations are publicly readable" ON citations FOR SELECT USING (true);
CREATE POLICY "Users can insert own citations" ON citations FOR INSERT WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL);
CREATE POLICY "Users can update own citations" ON citations FOR UPDATE USING (user_id = auth.uid()::text);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON papers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_authors_updated_at BEFORE UPDATE ON authors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
