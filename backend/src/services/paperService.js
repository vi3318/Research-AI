/**
 * Paper Service
 * Fetch and cache academic paper metadata from multiple sources:
 * - OpenAlex API (primary, free, comprehensive)
 * - arXiv API (for preprints)
 * - Cached database (papers table)
 * 
 * Integrates with pin endpoints to enrich paper data
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const debug = require('debug')('researchai:paperService');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class PaperService {
  constructor() {
    this.openAlexBaseUrl = 'https://api.openalex.org';
    this.arXivBaseUrl = 'http://export.arxiv.org/api/query';
    
    // Cache TTL: 7 days
    this.cacheTTL = 7 * 24 * 60 * 60 * 1000;
  }

  /**
   * Fetch paper metadata with automatic source detection and caching
   * @param {string} paper_id - DOI, arXiv ID, or OpenAlex ID
   * @returns {Promise<Object>} Paper metadata
   */
  async fetchPaperMetadata(paper_id) {
    if (!paper_id) {
      throw new Error('paper_id is required');
    }

    debug(`Fetching metadata for: ${paper_id}`);

    // Check cache first
    const cached = await this.getCachedMetadata(paper_id);
    if (cached) {
      debug(`Cache hit for ${paper_id}`);
      return cached;
    }

    // Detect ID type and fetch from appropriate source
    let metadata;
    
    if (this.isArXivId(paper_id)) {
      metadata = await this.fetchFromArXiv(paper_id);
    } else if (this.isDOI(paper_id)) {
      metadata = await this.fetchFromOpenAlex(paper_id);
    } else if (this.isOpenAlexId(paper_id)) {
      metadata = await this.fetchFromOpenAlex(paper_id);
    } else {
      // Try OpenAlex search as fallback
      metadata = await this.searchOpenAlex(paper_id);
    }

    // Cache the metadata
    if (metadata) {
      await this.cacheMetadata(metadata);
      debug(`Cached metadata for ${metadata.id}`);
    }

    return metadata;
  }

  /**
   * Get cached metadata from database
   */
  async getCachedMetadata(paper_id) {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .or(`id.eq.${paper_id},doi.eq.${paper_id},arxiv_id.eq.${paper_id}`)
        .single();

      if (error || !data) return null;

      // Check if cache is stale
      const cacheAge = Date.now() - new Date(data.updated_at).getTime();
      if (cacheAge > this.cacheTTL) {
        debug(`Cache stale for ${paper_id} (age: ${Math.floor(cacheAge / 1000 / 60 / 60)}h)`);
        return null;
      }

      return this.formatPaperMetadata(data);
    } catch (error) {
      debug(`Cache lookup failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache metadata in database
   */
  async cacheMetadata(metadata) {
    try {
      const { data, error } = await supabase
        .from('papers')
        .upsert({
          id: metadata.id,
          title: metadata.title,
          authors: metadata.authors,
          abstract: metadata.abstract,
          publication_date: metadata.publication_date,
          url: metadata.url,
          doi: metadata.doi,
          arxiv_id: metadata.arxiv_id,
          pdf_url: metadata.pdf_url,
          venue: metadata.venue,
          year: metadata.year,
          citation_count: metadata.citation_count,
          keywords: metadata.keywords,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        debug(`Failed to cache: ${error.message}`);
      }

      return data;
    } catch (error) {
      debug(`Cache save failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch from OpenAlex API
   */
  async fetchFromOpenAlex(identifier) {
    try {
      let url;
      
      if (this.isDOI(identifier)) {
        // DOI lookup
        url = `${this.openAlexBaseUrl}/works/doi:${identifier}`;
      } else if (this.isOpenAlexId(identifier)) {
        // Direct OpenAlex ID
        url = `${this.openAlexBaseUrl}/works/${identifier}`;
      } else {
        throw new Error('Invalid identifier for OpenAlex');
      }

      debug(`Fetching from OpenAlex: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'ResearchAI/1.0 (mailto:research@example.com)'
        },
        timeout: 10000
      });

      return this.parseOpenAlexResponse(response.data);
    } catch (error) {
      debug(`OpenAlex fetch failed: ${error.message}`);
      throw new Error(`Failed to fetch from OpenAlex: ${error.message}`);
    }
  }

  /**
   * Search OpenAlex by title or query
   */
  async searchOpenAlex(query) {
    try {
      const url = `${this.openAlexBaseUrl}/works`;
      
      debug(`Searching OpenAlex: ${query}`);

      const response = await axios.get(url, {
        params: {
          search: query,
          per_page: 1
        },
        headers: {
          'User-Agent': 'ResearchAI/1.0 (mailto:research@example.com)'
        },
        timeout: 10000
      });

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error('No results found');
      }

      return this.parseOpenAlexResponse(response.data.results[0]);
    } catch (error) {
      debug(`OpenAlex search failed: ${error.message}`);
      throw new Error(`Failed to search OpenAlex: ${error.message}`);
    }
  }

  /**
   * Parse OpenAlex API response
   */
  parseOpenAlexResponse(data) {
    return {
      id: data.id || `openalex:${Date.now()}`,
      title: data.title || 'Untitled',
      authors: data.authorships?.map(a => a.author?.display_name).filter(Boolean) || [],
      abstract: data.abstract || data.abstract_inverted_index ? 'Abstract available' : '',
      publication_date: data.publication_date || null,
      url: data.primary_location?.landing_page_url || data.id || '',
      doi: data.doi?.replace('https://doi.org/', '') || null,
      arxiv_id: null,
      pdf_url: data.primary_location?.pdf_url || data.best_oa_location?.pdf_url || null,
      venue: data.primary_location?.source?.display_name || 'Unknown',
      year: data.publication_year || null,
      citation_count: data.cited_by_count || 0,
      keywords: data.concepts?.slice(0, 10).map(c => c.display_name) || []
    };
  }

  /**
   * Fetch from arXiv API
   */
  async fetchFromArXiv(arxiv_id) {
    try {
      // Clean arXiv ID
      const cleanId = arxiv_id.replace('arxiv:', '').replace('arXiv:', '');
      
      debug(`Fetching from arXiv: ${cleanId}`);

      const response = await axios.get(this.arXivBaseUrl, {
        params: {
          id_list: cleanId,
          max_results: 1
        },
        timeout: 10000
      });

      return this.parseArXivResponse(response.data, cleanId);
    } catch (error) {
      debug(`arXiv fetch failed: ${error.message}`);
      throw new Error(`Failed to fetch from arXiv: ${error.message}`);
    }
  }

  /**
   * Parse arXiv API response (XML)
   */
  parseArXivResponse(xmlData, arxiv_id) {
    try {
      // Simple XML parsing (for production, use xml2js library)
      const titleMatch = xmlData.match(/<title>(.+?)<\/title>/);
      const summaryMatch = xmlData.match(/<summary>(.+?)<\/summary>/s);
      const publishedMatch = xmlData.match(/<published>(.+?)<\/published>/);
      const authorsMatch = xmlData.match(/<name>(.+?)<\/name>/g);
      const pdfMatch = xmlData.match(/<link.*?title="pdf".*?href="(.+?)".*?\/>/);

      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
      const abstract = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : '';
      const published = publishedMatch ? publishedMatch[1].split('T')[0] : null;
      const authors = authorsMatch 
        ? authorsMatch.map(m => m.replace(/<\/?name>/g, '').trim())
        : [];
      const pdf_url = pdfMatch ? pdfMatch[1] : `https://arxiv.org/pdf/${arxiv_id}.pdf`;

      return {
        id: `arxiv:${arxiv_id}`,
        title,
        authors,
        abstract,
        publication_date: published,
        url: `https://arxiv.org/abs/${arxiv_id}`,
        doi: null,
        arxiv_id,
        pdf_url,
        venue: 'arXiv',
        year: published ? parseInt(published.substring(0, 4)) : null,
        citation_count: 0,
        keywords: []
      };
    } catch (error) {
      debug(`arXiv parsing failed: ${error.message}`);
      throw new Error('Failed to parse arXiv response');
    }
  }

  /**
   * Format paper metadata for consistent output
   */
  formatPaperMetadata(data) {
    return {
      id: data.id,
      title: data.title,
      authors: Array.isArray(data.authors) ? data.authors : [],
      abstract: data.abstract || '',
      publication_date: data.publication_date,
      url: data.url,
      doi: data.doi,
      arxiv_id: data.arxiv_id,
      pdf_url: data.pdf_url,
      venue: data.venue,
      year: data.year,
      citation_count: data.citation_count || 0,
      keywords: data.keywords || []
    };
  }

  /**
   * Enrich pinned paper with metadata
   * Called when a paper is pinned
   */
  async enrichPinnedPaper(paper_id) {
    try {
      const metadata = await this.fetchPaperMetadata(paper_id);
      debug(`Enriched paper ${paper_id} with metadata`);
      return metadata;
    } catch (error) {
      debug(`Failed to enrich paper ${paper_id}: ${error.message}`);
      // Return minimal metadata on failure
      return {
        id: paper_id,
        title: 'Unknown Paper',
        authors: [],
        abstract: '',
        url: '',
        doi: null,
        arxiv_id: null,
        pdf_url: null
      };
    }
  }

  /**
   * Batch fetch metadata for multiple papers
   */
  async fetchBatch(paper_ids, options = {}) {
    const concurrency = options.concurrency || 5;
    const results = [];

    debug(`Batch fetching ${paper_ids.length} papers with concurrency ${concurrency}`);

    for (let i = 0; i < paper_ids.length; i += concurrency) {
      const chunk = paper_ids.slice(i, i + concurrency);
      const promises = chunk.map(id => this.fetchPaperMetadata(id).catch(error => ({
        id,
        error: error.message
      })));

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);

      debug(`Fetched batch ${i / concurrency + 1}/${Math.ceil(paper_ids.length / concurrency)}`);
    }

    return results;
  }

  /**
   * ID type detection helpers
   */
  isDOI(str) {
    return /^10\.\d{4,}\//.test(str) || str.startsWith('doi:');
  }

  isArXivId(str) {
    return /^\d{4}\.\d{4,5}(v\d+)?$/.test(str) || str.toLowerCase().startsWith('arxiv:');
  }

  isOpenAlexId(str) {
    return str.startsWith('https://openalex.org/W') || str.startsWith('W');
  }

  /**
   * Get service health
   */
  async getHealth() {
    const health = {
      status: 'healthy',
      sources: {},
      cache: {}
    };

    // Test OpenAlex
    try {
      await axios.get(`${this.openAlexBaseUrl}/works`, {
        params: { per_page: 1 },
        timeout: 5000
      });
      health.sources.openalex = 'healthy';
    } catch (error) {
      health.sources.openalex = 'unhealthy';
    }

    // Test arXiv
    try {
      await axios.get(this.arXivBaseUrl, {
        params: { id_list: '2201.00001', max_results: 1 },
        timeout: 5000
      });
      health.sources.arxiv = 'healthy';
    } catch (error) {
      health.sources.arxiv = 'unhealthy';
    }

    // Check database cache
    try {
      const { count, error } = await supabase
        .from('papers')
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        health.cache.status = 'healthy';
        health.cache.count = count || 0;
      } else {
        health.cache.status = 'unhealthy';
      }
    } catch (error) {
      health.cache.status = 'unhealthy';
    }

    health.status = health.sources.openalex === 'healthy' || health.sources.arxiv === 'healthy'
      ? 'healthy'
      : 'degraded';

    return health;
  }
}

// Export singleton
const paperService = new PaperService();

module.exports = {
  paperService,
  PaperService
};
