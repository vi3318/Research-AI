const Cite = require('citation-js');
const dbCitationService = require('./databaseCitationService');

class CitationService {
  constructor() {
    // Initialize supported citation styles with proper Citation.js templates
    this.supportedStyles = {
      ieee: 'ieee',           // IEEE style
      apa: 'apa',            // APA 7th edition
      mla: 'mla'             // MLA 9th edition
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
   * @param {string} style - Citation style (apa, mla, ieee)
   * @returns {string} Formatted citation
   */
  generateCitation(paperData, style = 'apa') {
    try {
      console.log(`[CitationService] Generating ${style} citation for:`, {
        title: paperData.title,
        authors: paperData.authors,
        year: paperData.year
      });

      // Normalize the style name
      const normalizedStyle = style.toLowerCase();

      // Use custom formatters for proper citation formats
      let citation;
      switch (normalizedStyle) {
        case 'ieee':
          citation = this.formatIEEE(paperData);
          break;
        case 'apa':
          citation = this.formatAPA(paperData);
          break;
        case 'mla':
          citation = this.formatMLA(paperData);
          break;
        default:
          citation = this.formatAPA(paperData);
      }

      console.log(`[CitationService] Generated ${style} citation:`, citation);

      return citation;
    } catch (error) {
      console.error(`[CitationService] Error generating ${style} citation:`, error);
      throw new Error(`Failed to generate ${style} citation: ${error.message}`);
    }
  }

  /**
   * Format citation in IEEE style
   */
  formatIEEE(paperData) {
    const authors = this.formatAuthorsIEEE(paperData.authors);
    const title = paperData.title || 'Untitled';
    const year = paperData.year || 'n.d.';
    const journal = paperData.journal || paperData.venue || paperData.publication || '';
    const doi = paperData.doi || paperData.DOI || '';
    const url = paperData.url || paperData.link || '';

    let citation = `${authors}, "${title},"`;
    
    if (journal) {
      citation += ` ${journal},`;
    }
    
    citation += ` ${year}.`;
    
    // Handle DOI - extract just the DOI number if it's a URL
    if (doi) {
      let cleanDoi = doi;
      if (doi.includes('doi.org/')) {
        cleanDoi = doi.split('doi.org/')[1];
      } else if (doi.includes('abstract/document/')) {
        // For IEEE links, just use the URL as reference
        citation += ` [Online]. Available: ${doi}`;
        return citation;
      }
      citation += ` doi: ${cleanDoi}`;
    } else if (url && !url.includes('abstract/document/')) {
      // Only add URL if it's not an IEEE abstract link
      citation += ` [Online]. Available: ${url}`;
    }

    return citation;
  }

  /**
   * Format citation in APA style (7th edition)
   */
  formatAPA(paperData) {
    const authors = this.formatAuthorsAPA(paperData.authors);
    const year = paperData.year || 'n.d.';
    const title = paperData.title || 'Untitled';
    const journal = paperData.journal || paperData.venue || paperData.publication || '';
    const doi = paperData.doi || paperData.DOI || '';
    const url = paperData.url || paperData.link || '';

    let citation = `${authors} (${year}). ${title}.`;
    
    if (journal) {
      citation += ` ${journal}.`;
    }
    
    // Handle DOI
    if (doi) {
      if (doi.includes('doi.org/')) {
        // Already a full DOI URL
        citation += ` ${doi}`;
      } else if (doi.includes('abstract/document/')) {
        // IEEE link - use as regular URL
        citation += ` Retrieved from ${doi}`;
      } else {
        // Just DOI number
        citation += ` https://doi.org/${doi}`;
      }
    } else if (url) {
      citation += ` Retrieved from ${url}`;
    }

    return citation;
  }

  /**
   * Format citation in MLA style (9th edition)
   */
  formatMLA(paperData) {
    const authors = this.formatAuthorsMLA(paperData.authors);
    const title = paperData.title || 'Untitled';
    const journal = paperData.journal || paperData.venue || paperData.publication || '';
    const year = paperData.year || 'n.d.';
    const doi = paperData.doi || paperData.DOI || '';
    const url = paperData.url || paperData.link || '';

    let citation = `${authors} "${title}."`;
    
    if (journal) {
      citation += ` ${journal},`;
    }
    
    citation += ` ${year}.`;
    
    // Handle DOI/URL
    if (doi) {
      if (doi.includes('doi.org/')) {
        citation += ` ${doi}.`;
      } else if (doi.includes('abstract/document/')) {
        citation += ` ${doi}.`;
      } else {
        citation += ` https://doi.org/${doi}.`;
      }
    } else if (url) {
      citation += ` ${url}.`;
    }

    return citation;
  }

  /**
   * Format authors for IEEE style (A. B. Author)
   */
  formatAuthorsIEEE(authors) {
    if (!authors) return 'Anonymous';
    
    let authorList = [];
    if (Array.isArray(authors)) {
      authorList = authors;
    } else if (typeof authors === 'string') {
      authorList = authors.split(',').map(a => a.trim());
    } else {
      authorList = [String(authors)];
    }

    // Filter out empty strings and special characters
    authorList = authorList.filter(a => a && a.length > 0 && a !== '…' && a !== '...');

    if (authorList.length === 0) return 'Anonymous';
    
    const formatted = authorList.slice(0, 3).map(author => {
      const trimmed = author.trim();
      // Skip if it's just special characters
      if (trimmed === '…' || trimmed === '...' || trimmed.length === 0) return null;
      
      const parts = trimmed.split(' ').filter(p => p.length > 0);
      if (parts.length === 1) return parts[0];
      
      // Get initials for first/middle names, keep last name
      const lastName = parts[parts.length - 1];
      const initials = parts.slice(0, -1)
        .map(n => n.charAt(0).toUpperCase() + '.')
        .join(' ');
      return `${initials} ${lastName}`;
    }).filter(a => a !== null);

    if (authorList.length > 3) {
      return formatted.join(', ') + ', et al.';
    }
    
    return formatted.join(', ');
  }

  /**
   * Format authors for APA style (Last, F. M.)
   */
  formatAuthorsAPA(authors) {
    if (!authors) return 'Anonymous';
    
    let authorList = [];
    if (Array.isArray(authors)) {
      authorList = authors;
    } else if (typeof authors === 'string') {
      authorList = authors.split(',').map(a => a.trim());
    } else {
      authorList = [String(authors)];
    }

    // Filter out empty strings, special characters, and numbers (year values)
    authorList = authorList.filter(a => {
      if (!a || a.length === 0) return false;
      if (a === '…' || a === '...') return false;
      // Filter out year values that might have been included
      if (/^\d{4}$/.test(a.trim())) return false;
      return true;
    });

    if (authorList.length === 0) return 'Anonymous';
    
    const formatted = authorList.slice(0, 20).map(author => {
      const trimmed = author.trim();
      const parts = trimmed.split(' ').filter(p => p.length > 0);
      if (parts.length === 1) return parts[0];
      
      const lastName = parts[parts.length - 1];
      const initials = parts.slice(0, -1)
        .map(n => n.charAt(0).toUpperCase() + '.')
        .join(' ');
      return `${lastName}, ${initials}`;
    });

    if (formatted.length === 1) {
      return formatted[0];
    } else if (formatted.length === 2) {
      return `${formatted[0]}, & ${formatted[1]}`;
    } else if (formatted.length <= 20) {
      return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
    } else {
      return formatted.slice(0, 19).join(', ') + ', ... ' + formatted[formatted.length - 1];
    }
  }

  /**
   * Format authors for MLA style (Last, First)
   */
  formatAuthorsMLA(authors) {
    if (!authors) return 'Anonymous';
    
    let authorList = [];
    if (Array.isArray(authors)) {
      authorList = authors;
    } else if (typeof authors === 'string') {
      authorList = authors.split(',').map(a => a.trim());
    } else {
      authorList = [String(authors)];
    }

    // Filter out empty strings and special characters
    authorList = authorList.filter(a => a && a.length > 0 && a !== '…' && a !== '...');

    if (authorList.length === 0) return 'Anonymous';
    
    // MLA: First author as "Last, First", others as "First Last"
    const firstAuthor = authorList[0].trim();
    const parts = firstAuthor.split(' ').filter(p => p.length > 0);
    
    let formatted;
    if (parts.length === 1) {
      formatted = parts[0];
    } else {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(' ');
      formatted = `${lastName}, ${firstName}`;
    }

    if (authorList.length === 2) {
      const secondAuthor = authorList[1].trim();
      formatted += `, and ${secondAuthor}`;
    } else if (authorList.length > 2) {
      formatted += ', et al.';
    }

    return formatted + '.';
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
