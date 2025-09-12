const { supabase } = require('../config/supabase');

class DatabaseCitationService {
  constructor() {
    this.tableName = 'citations';
    this.papersTable = 'papers';
    this.authorsTable = 'authors';
    this.paperAuthorsTable = 'paper_authors';
  }

  /**
   * Store or update a paper in the database
   * @param {Object} paperData - Paper metadata
   * @returns {Object} Stored paper with ID
   */
  async storePaper(paperData) {
    try {
      // Check if paper already exists
      let existingPaper = null;
      if (paperData.doi) {
        const { data } = await supabase
          .from(this.papersTable)
          .select('*')
          .eq('doi', paperData.doi)
          .single();
        existingPaper = data;
      }

      const paperRecord = {
        doi: paperData.doi,
        arxiv_id: paperData.arxiv_id,
        pubmed_id: paperData.pubmed_id,
        title: paperData.title,
        abstract: paperData.abstract,
        publication_year: paperData.year || paperData.publication_year,
        publication_date: paperData.published_date || paperData.publication_date,
        journal: paperData.journal || paperData.venue || paperData.publication,
        volume: paperData.volume,
        issue: paperData.issue,
        pages: paperData.pages,
        publisher: paperData.publisher,
        citation_count: paperData.citationCount || paperData.citation_count || 0,
        is_open_access: paperData.isOpenAccess || paperData.is_open_access || false,
        oa_host_type: paperData.oaHostType || paperData.oa_host_type,
        pdf_url: paperData.pdfUrl || paperData.pdf_url,
        paper_url: paperData.url || paperData.paper_url,
        categories: paperData.categories || [],
        keywords: paperData.keywords || [],
        language: paperData.language || 'en',
        source_databases: paperData.sources || paperData.source_databases || [],
        metadata: {
          original_data: paperData,
          relevance_score: paperData.relevanceScore,
          ...paperData.metadata
        }
      };

      let storedPaper;
      if (existingPaper) {
        // Update existing paper
        const { data, error } = await supabase
          .from(this.papersTable)
          .update(paperRecord)
          .eq('id', existingPaper.id)
          .select()
          .single();
        
        if (error) throw error;
        storedPaper = data;
      } else {
        // Insert new paper
        const { data, error } = await supabase
          .from(this.papersTable)
          .insert(paperRecord)
          .select()
          .single();
        
        if (error) throw error;
        storedPaper = data;
      }

      // Store authors if provided
      if (paperData.authors && Array.isArray(paperData.authors)) {
        await this.storeAuthors(storedPaper.id, paperData.authors);
      }

      return storedPaper;
    } catch (error) {
      console.error('Error storing paper:', error);
      throw error;
    }
  }

  /**
   * Store authors and link them to a paper
   * @param {string} paperId - Paper UUID
   * @param {Array} authors - Array of author names or objects
   */
  async storeAuthors(paperId, authors) {
    try {
      for (let i = 0; i < authors.length; i++) {
        const authorData = authors[i];
        const authorName = typeof authorData === 'string' ? authorData : authorData.name;
        const normalizedName = authorName.toLowerCase().trim();

        // Check if author exists
        let { data: existingAuthor } = await supabase
          .from(this.authorsTable)
          .select('*')
          .eq('normalized_name', normalizedName)
          .single();

        let authorId;
        if (existingAuthor) {
          authorId = existingAuthor.id;
        } else {
          // Create new author
          const { data: newAuthor, error } = await supabase
            .from(this.authorsTable)
            .insert({
              name: authorName,
              normalized_name: normalizedName,
              email: typeof authorData === 'object' ? authorData.email : null,
              affiliation: typeof authorData === 'object' ? authorData.affiliation : null,
              orcid: typeof authorData === 'object' ? authorData.orcid : null
            })
            .select()
            .single();

          if (error) throw error;
          authorId = newAuthor.id;
        }

        // Link author to paper
        await supabase
          .from(this.paperAuthorsTable)
          .upsert({
            paper_id: paperId,
            author_id: authorId,
            author_order: i + 1
          });
      }
    } catch (error) {
      console.error('Error storing authors:', error);
      // Don't throw error for author storage failures
    }
  }

  /**
   * Get cached citation for a paper
   * @param {string} paperId - Paper ID
   * @param {string} style - Citation style
   * @returns {Object|null} Cached citation or null
   */
  async getCachedCitation(paperId, style) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('paper_id', paperId)
        .eq('style', style.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting cached citation:', error);
      return null;
    }
  }

  /**
   * Store citation in cache
   * @param {string} paperId - Paper ID
   * @param {string} style - Citation style
   * @param {string} citationText - Formatted citation
   * @param {string} userId - User ID (optional)
   */
  async storeCitation(paperId, style, citationText, userId = null) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .upsert({
          paper_id: paperId,
          user_id: userId,
          style: style.toLowerCase(),
          citation_text: citationText,
          usage_count: 1,
          last_used_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing citation:', error);
      // Don't throw error for caching failures
    }
  }

  /**
   * Update citation usage count
   * @param {string} paperId - Paper ID
   * @param {string} style - Citation style
   */
  async incrementCitationUsage(paperId, style) {
    try {
      const { error } = await supabase.rpc('increment_citation_usage', {
        p_paper_id: paperId,
        p_style: style.toLowerCase()
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing citation usage:', error);
    }
  }

  /**
   * Get popular papers based on citation usage
   * @param {number} limit - Number of papers to return
   * @returns {Array} Popular papers
   */
  async getPopularPapers(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('popular_papers')
        .select('*')
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting popular papers:', error);
      return [];
    }
  }

  /**
   * Search papers in database
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching papers
   */
  async searchPapers(query, options = {}) {
    try {
      let queryBuilder = supabase
        .from(this.papersTable)
        .select(`
          *,
          paper_authors!inner(
            author_order,
            authors(name, affiliation)
          )
        `);

      // Text search on title and abstract
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,abstract.ilike.%${query}%`);
      }

      // Apply filters
      if (options.year_from) {
        queryBuilder = queryBuilder.gte('publication_year', options.year_from);
      }
      if (options.year_to) {
        queryBuilder = queryBuilder.lte('publication_year', options.year_to);
      }
      if (options.journal) {
        queryBuilder = queryBuilder.ilike('journal', `%${options.journal}%`);
      }
      if (options.open_access_only) {
        queryBuilder = queryBuilder.eq('is_open_access', true);
      }

      // Ordering
      const orderBy = options.order_by || 'citation_count';
      const orderDirection = options.order_direction || 'desc';
      queryBuilder = queryBuilder.order(orderBy, { ascending: orderDirection === 'asc' });

      // Limit
      const limit = Math.min(options.limit || 50, 100);
      queryBuilder = queryBuilder.limit(limit);

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching papers:', error);
      return [];
    }
  }

  /**
   * Get citation statistics
   * @param {string} userId - User ID (optional)
   * @returns {Object} Citation statistics
   */
  async getCitationStats(userId = null) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('style, usage_count');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate statistics
      const stats = {
        total_citations: 0,
        by_style: {},
        most_used_style: null
      };

      data?.forEach(citation => {
        stats.total_citations += citation.usage_count;
        if (!stats.by_style[citation.style]) {
          stats.by_style[citation.style] = 0;
        }
        stats.by_style[citation.style] += citation.usage_count;
      });

      // Find most used style
      let maxUsage = 0;
      Object.entries(stats.by_style).forEach(([style, count]) => {
        if (count > maxUsage) {
          maxUsage = count;
          stats.most_used_style = style;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting citation stats:', error);
      return { total_citations: 0, by_style: {}, most_used_style: null };
    }
  }

  /**
   * Clean up expired search results and old citations
   */
  async cleanupOldData() {
    try {
      // Clean expired search results
      await supabase.rpc('clean_expired_search_results');
      
      // Could add cleanup for old, unused citations here
      console.log('Database cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

module.exports = new DatabaseCitationService();
