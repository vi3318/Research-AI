const { supabase } = require('../config/supabase');
const paperEmbeddings = require('../services/paperEmbeddings');
const { ArxivScraper, PubMedScraper, OpenAlexScraper, GoogleScholarScraper } = require('../services/paperScrapers');
const { asyncHandler } = require('../utils/errorHandler');

/**
 * Semantic Search Controller
 * Handles paper search with vector similarity and auto-scraping
 */

/**
 * POST /api/semantic-search
 * Search for papers using semantic similarity
 * Auto-scrapes from multiple sources if not enough results in database
 */
const semanticSearch = asyncHandler(async (req, res) => {
  const { query, sources = ['arxiv', 'pubmed', 'openalex'], limit = 10, threshold = 0.5 } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }

  console.log(`[Semantic Search] Query: "${query}", Sources: ${sources.join(', ')}, Limit: ${limit}`);

  try {
    // Step 1: Generate embedding for the query
    const queryEmbedding = await paperEmbeddings.embedQuery(query);
    
    // Step 2: Search existing papers in database using vector similarity
    const { data: existingPapers, error: searchError } = await supabase
      .rpc('search_papers_by_embedding', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      });

    if (searchError) {
      console.error('[Semantic Search] Database search error:', searchError);
    }

    console.log(`[Semantic Search] Found ${existingPapers?.length || 0} papers in database`);

    // Step 3: If not enough results, scrape new papers
    let allPapers = existingPapers || [];
    
    if (allPapers.length < limit) {
      console.log(`[Semantic Search] Insufficient results (${allPapers.length}/${limit}), scraping new papers...`);
      
      const scrapedPapers = await scrapeAndIndexPapers(query, sources, limit);
      
      // Re-run vector search to get newly indexed papers
      const { data: newResults } = await supabase
        .rpc('search_papers_by_embedding', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });
      
      allPapers = newResults || allPapers;
      console.log(`[Semantic Search] After scraping: ${allPapers.length} total papers`);
    }

    // Step 4: Return results
    res.json({
      query,
      results: allPapers.slice(0, limit),
      total: allPapers.length,
      scraped: allPapers.length > (existingPapers?.length || 0),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Semantic Search] Error:', error);
    res.status(500).json({ 
      error: 'Semantic search failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/papers/:id
 * Get full details of a specific paper
 */
const getPaper = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: paper, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  res.json({ paper });
});

/**
 * GET /api/papers
 * Get all papers with optional filters
 */
const getAllPapers = asyncHandler(async (req, res) => {
  const { source, year, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('papers')
    .select('id, title, authors, abstract, year, source, link, citation_count, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (source) {
    query = query.eq('source', source);
  }

  if (year) {
    query = query.eq('year', parseInt(year));
  }

  query = query.range(offset, offset + limit - 1);

  const { data: papers, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    papers,
    total: count,
    limit,
    offset
  });
});

/**
 * DELETE /api/papers/:id
 * Delete a paper (admin only)
 */
const deletePaper = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('papers')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, message: 'Paper deleted' });
});

/**
 * Helper: Scrape and index papers from multiple sources
 */
async function scrapeAndIndexPapers(query, sources, limit = 10) {
  const scrapers = {
    arxiv: new ArxivScraper(),
    pubmed: new PubMedScraper(),
    openalex: new OpenAlexScraper(),
    google_scholar: new GoogleScholarScraper()
  };

  const allScrapedPapers = [];
  const papersPerSource = Math.ceil(limit / sources.length);

  // Scrape from each source in parallel
  const scrapePromises = sources.map(async (source) => {
    const scraper = scrapers[source];
    if (!scraper) {
      console.warn(`[Scraper] Unknown source: ${source}`);
      return [];
    }

    try {
      return await scraper.search(query, papersPerSource);
    } catch (error) {
      console.error(`[Scraper] Error from ${source}:`, error.message);
      return [];
    }
  });

  const results = await Promise.all(scrapePromises);
  results.forEach(papers => allScrapedPapers.push(...papers));

  console.log(`[Scraper] Total scraped papers: ${allScrapedPapers.length}`);

  if (allScrapedPapers.length === 0) {
    console.log('[Scraper] No papers scraped from any source');
    return [];
  }

  // Generate embeddings for scraped papers
  console.log('[Embeddings] Generating embeddings for scraped papers...');
  const embeddings = await paperEmbeddings.embedPapersBatch(allScrapedPapers);

  // Prepare papers for insertion
  const papersToInsert = allScrapedPapers.map((paper, index) => ({
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract || '',
    year: paper.year,
    source: paper.source,
    source_id: paper.source_id,
    link: paper.link,
    pdf_url: paper.pdf_url,
    doi: paper.doi,
    venue: paper.venue,
    citation_count: paper.citation_count || 0,
    embedding: embeddings[index],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_scraped_at: new Date().toISOString()
  }));

  // Insert into Supabase (upsert to handle duplicates)
  console.log(`[Database] Inserting ${papersToInsert.length} papers...`);
  
  const { data: insertedPapers, error: insertError } = await supabase
    .from('papers')
    .upsert(papersToInsert, { 
      onConflict: 'source,source_id',
      ignoreDuplicates: false 
    })
    .select();

  if (insertError) {
    console.error('[Database] Insert error:', insertError);
    // Continue even if some inserts fail
  } else {
    console.log(`[Database] Successfully inserted ${insertedPapers?.length || 0} papers`);
  }

  return insertedPapers || [];
}

/**
 * GET /api/semantic-search/stats
 * Get statistics about indexed papers
 */
const getStats = asyncHandler(async (req, res) => {
  // Get total count
  const { count: totalCount } = await supabase
    .from('papers')
    .select('*', { count: 'exact', head: true });

  // Get count by source
  const { data: bySource } = await supabase
    .from('papers')
    .select('source')
    .then(({ data }) => {
      const counts = {};
      data?.forEach(p => {
        counts[p.source] = (counts[p.source] || 0) + 1;
      });
      return { data: counts };
    });

  // Get count by year
  const { data: byYear } = await supabase
    .from('papers')
    .select('year')
    .then(({ data }) => {
      const counts = {};
      data?.forEach(p => {
        if (p.year) {
          counts[p.year] = (counts[p.year] || 0) + 1;
        }
      });
      return { data: counts };
    });

  res.json({
    total: totalCount || 0,
    bySource: bySource || {},
    byYear: byYear || {},
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  semanticSearch,
  getPaper,
  getAllPapers,
  deletePaper,
  getStats
};
