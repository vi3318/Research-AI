const Cite = require('citation-js');
const dbCitationService = require('./databaseCitationService');

class CitationService {
  constructor() {
    // Initialize supported citation styles
    this.supportedStyles = {
      ieee: 'ieee',
      apa: 'apa',
      mla: 'mla'
    };
  }

  /**
   * Generate citation from paper metadata with database caching
   * @param {Object} paperData - Paper metadata
   * @param {string} style - Citation style (apa, mla, chicago, ieee, harvard, bibtex, vancouver)
   * @param {string} userId - User ID for tracking
   * @returns {string} Formatted citation
   */
  async generateCitationWithCache(paperData, style = 'apa', userId = null) {
    try {
      // Try to get paper from database first
      let storedPaper = null;
      if (paperData.doi || paperData.paper_id) {
        try {
          storedPaper = await dbCitationService.storePaper(paperData);
        } catch (error) {
          console.warn('Failed to store/retrieve paper:', error.message);
        }
      }

      const paperId = storedPaper?.id || null;

      // Check cache if we have a paper ID
      if (paperId) {
        const cachedCitation = await dbCitationService.getCachedCitation(paperId, style);
        if (cachedCitation) {
          // Update usage count
          await dbCitationService.incrementCitationUsage(paperId, style);
          return cachedCitation.citation_text;
        }
      }

      // Generate new citation
      const citation = this.generateCitation(paperData, style);

      // Store in cache if we have a paper ID
      if (paperId) {
        await dbCitationService.storeCitation(paperId, style, citation, userId);
      }

      return citation;
    } catch (error) {
      console.error('Error generating citation with cache:', error);
      // Fallback to direct generation
      return this.generateCitation(paperData, style);
    }
  }
  /**
   * Generate citation from paper metadata
   * @param {Object} paperData - Paper metadata
   * @param {string} style - Citation style (apa, mla, chicago, ieee, harvard, bibtex, vancouver)
   * @returns {string} Formatted citation
   */
  generateCitation(paperData, style = 'apa') {
    try {
      // Normalize the style name
      const normalizedStyle = style.toLowerCase();
      const citationStyle = this.supportedStyles[normalizedStyle] || this.supportedStyles.apa;

      // Convert paper data to Citation.js format
      const citationData = this.convertToCitationFormat(paperData);

      // Create citation using Citation.js
      const cite = new Cite(citationData);
      
      // Generate citation in the requested style
      const citation = cite.format('bibliography', {
        format: 'text',
        template: citationStyle,
        lang: 'en-US'
      });

      return citation.trim();
    } catch (error) {
      console.error('Error generating citation:', error);
      throw new Error(`Failed to generate ${style} citation: ${error.message}`);
    }
  }

  /**
   * Generate multiple citation styles for a paper
   * @param {Object} paperData - Paper metadata
   * @returns {Object} Citations in all supported styles
   */
  generateAllCitations(paperData) {
    const citations = {};
    
    Object.keys(this.supportedStyles).forEach(style => {
      try {
        citations[style] = this.generateCitation(paperData, style);
      } catch (error) {
        console.error(`Error generating ${style} citation:`, error);
        citations[style] = `Error generating ${style.toUpperCase()} citation`;
      }
    });

    return citations;
  }

  /**
   * Convert paper metadata to Citation.js format
   * @param {Object} paperData - Raw paper metadata
   * @returns {Object} Citation.js compatible format
   */
  convertToCitationFormat(paperData) {
    const citationData = {
      type: 'article-journal',
      id: paperData.id || paperData.doi || Math.random().toString(36).substr(2, 9)
    };

    // Title
    if (paperData.title) {
      citationData.title = paperData.title;
    }

    // Authors
    if (paperData.authors && Array.isArray(paperData.authors)) {
      citationData.author = paperData.authors.map(author => {
        if (typeof author === 'string') {
          // Simple string author name
          const nameParts = author.split(' ');
          return {
            family: nameParts.pop(),
            given: nameParts.join(' ')
          };
        } else if (author.name) {
          // Author object with name
          const nameParts = author.name.split(' ');
          return {
            family: nameParts.pop(),
            given: nameParts.join(' ')
          };
        } else if (author.given || author.family) {
          // Already in proper format
          return author;
        }
        return { literal: author.toString() };
      });
    } else if (paperData.author) {
      // Single author or string of authors
      const authorStr = Array.isArray(paperData.author) ? paperData.author.join(', ') : paperData.author;
      const authors = authorStr.split(',').map(name => {
        const trimmed = name.trim();
        const nameParts = trimmed.split(' ');
        return {
          family: nameParts.pop(),
          given: nameParts.join(' ')
        };
      });
      citationData.author = authors;
    }

    // Publication year
    if (paperData.year) {
      citationData.issued = { 'date-parts': [[parseInt(paperData.year)]] };
    } else if (paperData.published_date) {
      const year = new Date(paperData.published_date).getFullYear();
      citationData.issued = { 'date-parts': [[year]] };
    } else if (paperData.publication_date) {
      const year = new Date(paperData.publication_date).getFullYear();
      citationData.issued = { 'date-parts': [[year]] };
    }

    // Journal/Publication
    if (paperData.journal) {
      citationData['container-title'] = paperData.journal;
    } else if (paperData.venue) {
      citationData['container-title'] = paperData.venue;
    } else if (paperData.publication) {
      citationData['container-title'] = paperData.publication;
    }

    // Volume and Issue
    if (paperData.volume) {
      citationData.volume = paperData.volume.toString();
    }
    if (paperData.issue) {
      citationData.issue = paperData.issue.toString();
    }

    // Pages
    if (paperData.pages) {
      citationData.page = paperData.pages;
    } else if (paperData.page_start && paperData.page_end) {
      citationData.page = `${paperData.page_start}-${paperData.page_end}`;
    }

    // DOI
    if (paperData.doi) {
      citationData.DOI = paperData.doi.replace('https://doi.org/', '');
    }

    // URL
    if (paperData.url) {
      citationData.URL = paperData.url;
    } else if (paperData.link) {
      citationData.URL = paperData.link;
    }

    // Publisher
    if (paperData.publisher) {
      citationData.publisher = paperData.publisher;
    }

    // Abstract (for some citation styles)
    if (paperData.abstract) {
      citationData.abstract = paperData.abstract;
    }

    return citationData;
  }

  /**
   * Validate paper data for citation generation
   * @param {Object} paperData - Paper metadata
   * @returns {Object} Validation result
   */
  validatePaperData(paperData) {
    const errors = [];
    const warnings = [];

    if (!paperData.title) {
      errors.push('Title is required for citation generation');
    }

    if (!paperData.authors && !paperData.author) {
      warnings.push('No authors found - citation may be incomplete');
    }

    if (!paperData.year && !paperData.published_date && !paperData.publication_date) {
      warnings.push('No publication year found - citation may be incomplete');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available citation styles
   * @returns {Array} List of supported citation styles
   */
  getSupportedStyles() {
    return Object.keys(this.supportedStyles).map(style => ({
      key: style,
      name: style.toUpperCase(),
      displayName: this.getStyleDisplayName(style)
    }));
  }

  /**
   * Get display name for citation style
   * @param {string} style - Style key
   * @returns {string} Display name
   */
  getStyleDisplayName(style) {
    const displayNames = {
      apa: 'APA (American Psychological Association)',
      mla: 'MLA (Modern Language Association)',
      chicago: 'Chicago (Author-Date)',
      ieee: 'IEEE (Institute of Electrical and Electronics Engineers)',
      harvard: 'Harvard (Author-Date)',
      bibtex: 'BibTeX (LaTeX Bibliography)',
      vancouver: 'Vancouver (Medical Journals)'
    };
    return displayNames[style] || style.toUpperCase();
  }
}

module.exports = new CitationService();
