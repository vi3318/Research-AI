const citationService = require('../services/citationService');
const dbCitationService = require('../services/databaseCitationService');

class CitationController {
  /**
   * Generate citation for a single paper with caching
   * POST /api/citations/generate
   * Body: { paperData: {}, style: 'apa', userId?: 'user123' }
   */
  async generateCitation(req, res) {
    try {
      const { paperData, style = 'apa', userId } = req.body;

      if (!paperData) {
        return res.status(400).json({
          error: 'Paper data is required',
          message: 'Please provide paper metadata in the request body'
        });
      }

      // Validate paper data
      const validation = citationService.validatePaperData(paperData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid paper data',
          messages: validation.errors,
          warnings: validation.warnings
        });
      }

      // Generate citation with caching
      const citation = await citationService.generateCitationWithCache(paperData, style, userId);

      res.json({
        success: true,
        citation,
        style: style.toUpperCase(),
        warnings: validation.warnings,
        cached: true // Could be enhanced to track if citation was from cache
      });

    } catch (error) {
      console.error('Citation generation error:', error);
      res.status(500).json({
        error: 'Failed to generate citation',
        message: error.message
      });
    }
  }

  /**
   * Generate citations in all supported styles with caching
   * POST /api/citations/generate-all
   * Body: { paperData: {}, userId?: 'user123' }
   */
  async generateAllCitations(req, res) {
    try {
      const { paperData, userId } = req.body;

      if (!paperData) {
        return res.status(400).json({
          error: 'Paper data is required',
          message: 'Please provide paper metadata in the request body'
        });
      }

      // Validate paper data
      const validation = citationService.validatePaperData(paperData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid paper data',
          messages: validation.errors,
          warnings: validation.warnings
        });
      }

      // Generate all citations with caching
      const citations = {};
      const styles = Object.keys(citationService.supportedStyles);
      
      for (const style of styles) {
        try {
          citations[style] = await citationService.generateCitationWithCache(paperData, style, userId);
        } catch (error) {
          console.error(`Error generating ${style} citation:`, error);
          citations[style] = `Error generating ${style.toUpperCase()} citation`;
        }
      }

      res.json({
        success: true,
        citations,
        supportedStyles: citationService.getSupportedStyles(),
        warnings: validation.warnings
      });

    } catch (error) {
      console.error('Citation generation error:', error);
      res.status(500).json({
        error: 'Failed to generate citations',
        message: error.message
      });
    }
  }

  /**
   * Get supported citation styles
   * GET /api/citations/styles
   */
  async getSupportedStyles(req, res) {
    try {
      const styles = citationService.getSupportedStyles();
      
      res.json({
        success: true,
        styles
      });

    } catch (error) {
      console.error('Error fetching citation styles:', error);
      res.status(500).json({
        error: 'Failed to fetch citation styles',
        message: error.message
      });
    }
  }

  /**
   * Generate citation from paper ID (fetch from database)
   * GET /api/citations/paper/:id?style=apa
   */
  async generateCitationFromId(req, res) {
    try {
      const { id } = req.params;
      const { style = 'apa' } = req.query;

      // This would typically fetch from your database
      // For now, return an error since we don't have the paper service integrated
      res.status(501).json({
        error: 'Not implemented',
        message: 'Citation from paper ID requires database integration'
      });

    } catch (error) {
      console.error('Citation generation error:', error);
      res.status(500).json({
        error: 'Failed to generate citation',
        message: error.message
      });
    }
  }

  /**
   * Validate paper data for citation generation
   * POST /api/citations/validate
   * Body: { paperData: {} }
   */
  async validatePaperData(req, res) {
    try {
      const { paperData } = req.body;

      if (!paperData) {
        return res.status(400).json({
          error: 'Paper data is required',
          message: 'Please provide paper metadata in the request body'
        });
      }

      const validation = citationService.validatePaperData(paperData);

      res.json({
        success: true,
        validation
      });

    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        error: 'Failed to validate paper data',
        message: error.message
      });
    }
  }

  /**
   * Get citation statistics for a user or globally
   * GET /api/citations/stats?userId=123
   */
  async getCitationStats(req, res) {
    try {
      const { userId } = req.query;
      const stats = await dbCitationService.getCitationStats(userId);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Error fetching citation stats:', error);
      res.status(500).json({
        error: 'Failed to fetch citation statistics',
        message: error.message
      });
    }
  }

  /**
   * Get popular papers based on citation usage
   * GET /api/citations/popular?limit=20
   */
  async getPopularPapers(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const papers = await dbCitationService.getPopularPapers(limit);

      res.json({
        success: true,
        papers,
        count: papers.length
      });

    } catch (error) {
      console.error('Error fetching popular papers:', error);
      res.status(500).json({
        error: 'Failed to fetch popular papers',
        message: error.message
      });
    }
  }

  /**
   * Search papers in database
   * POST /api/citations/search
   * Body: { query: 'search term', options: {} }
   */
  async searchPapers(req, res) {
    try {
      const { query, options = {} } = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Search query is required',
          message: 'Please provide a search query'
        });
      }

      const papers = await dbCitationService.searchPapers(query, options);

      res.json({
        success: true,
        papers,
        count: papers.length,
        query,
        options
      });

    } catch (error) {
      console.error('Error searching papers:', error);
      res.status(500).json({
        error: 'Failed to search papers',
        message: error.message
      });
    }
  }
}

module.exports = new CitationController();
