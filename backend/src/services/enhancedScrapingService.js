const debug = require("debug")("researchai:enhanced-scraping");
const scholar = require("./scholarScraperService");
const { searchArxiv } = require("./arxivService");
const { searchPubMed } = require("./pubmedService");
const { searchWorkByTitle } = require("./crossrefService");
const { lookupByDOI, searchByTopic, enrichPapers } = require("./unpaywallService");
const openalex = require("./openalexService");
const pdfProcessorService = require("./pdfProcessorService");
const { withRetry } = require("../utils/retry");

class EnhancedScrapingService {
  constructor() {
    this.maxConcurrentRequests = 3;
    this.requestQueue = [];
    this.activeRequests = 0;
  }

  // Enhanced search with parallel processing and enrichment
  async comprehensiveSearch(topic, options = {}) {
    const maxResults = options.maxResults || 15;
    const sources = this.parseSources(options.sources);
    
    debug('Starting comprehensive search for: %s with sources: %s, maxResults: %d', topic, sources.join(','), maxResults);

    // Phase 1: Parallel search across all sources
    const searchResults = await this.parallelSearch(topic, sources, maxResults);
    
    // Phase 2: Enrich results with metadata and PDFs
    const enrichedResults = await this.enrichResults(searchResults);
    
    // Phase 3: Advanced deduplication and ranking
    const finalResults = await this.deduplicateAndRank(enrichedResults, topic, maxResults);
    
    // Final safety check to ensure we don't exceed maxResults
    const limitedResults = finalResults.slice(0, maxResults);
    
    debug('Final results: %d papers, limited to %d (requested: %d)', finalResults.length, limitedResults.length, maxResults);
    
    return {
      query: topic,
      sources: sources,
      totalFound: Object.values(searchResults.bySource).reduce((sum, arr) => sum + arr.length, 0),
      results: limitedResults,
      bySource: searchResults.bySource,
      enrichmentStats: this.getEnrichmentStats(enrichedResults),
      timestamp: new Date().toISOString()
    };
  }

  // Parse and validate sources
  parseSources(sources) {
    let sourceList = sources || (process.env.DEFAULT_SOURCES ? String(process.env.DEFAULT_SOURCES) : "scholar,arxiv,pubmed,openalex,unpaywall");
    
    if (typeof sourceList === "string") {
      sourceList = sourceList.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    }

    // Filter disabled sources
    if (process.env.SCHOLAR_ENABLED === "false") {
      sourceList = sourceList.filter(s => s !== "scholar");
    }

    return sourceList;
  }

  // Parallel search across multiple sources
  async parallelSearch(topic, sources, maxResults) {
    const bySource = {};
    const searchPromises = [];

    // Scholar search with enhanced retry logic
    if (sources.includes("scholar")) {
      searchPromises.push(
        this.executeWithQueue(async () => {
          try {
            const results = await withRetry(
              () => scholar.searchScholar(topic, Math.min(maxResults, 10)), // Cap scholar results
              {
                retries: 2,
                minDelayMs: 3000,
                maxDelayMs: 10000,
                factor: 2,
                onRetry: (e, attempt, delay) => {
                  debug("Scholar retry %d: %s (waiting %dms)", attempt, e.message, delay);
                }
              }
            );
            bySource.scholar = results.map(r => ({ ...r, source: 'scholar' }));
            debug('Scholar found %d papers', results.length);
          } catch (error) {
            debug('Scholar search failed: %s', error.message);
            bySource.scholar = [];
          }
        })
      );
    }

    // ArXiv search
    if (sources.includes("arxiv")) {
      searchPromises.push(
        this.executeWithQueue(async () => {
          try {
            const results = await withRetry(
              () => searchArxiv(topic, maxResults),
              { retries: 1, minDelayMs: 1000 }
            );
            bySource.arxiv = results.map(r => ({ ...r, source: 'arxiv' }));
            debug('ArXiv found %d papers', results.length);
          } catch (error) {
            debug('ArXiv search failed: %s', error.message);
            bySource.arxiv = [];
          }
        })
      );
    }

    // PubMed search
    if (sources.includes("pubmed")) {
      searchPromises.push(
        this.executeWithQueue(async () => {
          try {
            const results = await withRetry(
              () => searchPubMed(topic, maxResults),
              { retries: 1, minDelayMs: 1000 }
            );
            bySource.pubmed = results.map(r => ({ ...r, source: 'pubmed' }));
            debug('PubMed found %d papers', results.length);
          } catch (error) {
            debug('PubMed search failed: %s', error.message);
            bySource.pubmed = [];
          }
        })
      );
    }

    // OpenAlex search
    if (sources.includes("openalex")) {
      searchPromises.push(
        this.executeWithQueue(async () => {
          try {
            const results = await withRetry(
              () => openalex.searchWorks(topic, maxResults),
              { retries: 1, minDelayMs: 500 }
            );
            bySource.openalex = results.map(r => ({ ...r, source: 'openalex' }));
            debug('OpenAlex found %d papers', results.length);
          } catch (error) {
            debug('OpenAlex search failed: %s', error.message);
            bySource.openalex = [];
          }
        })
      );
    }

    // Unpaywall search (Open Access papers from multiple repositories)
    if (sources.includes("unpaywall")) {
      searchPromises.push(
        this.executeWithQueue(async () => {
          try {
            const results = await withRetry(
              () => searchByTopic(topic, Math.min(maxResults, 15)), // Cap unpaywall results
              { retries: 1, minDelayMs: 1000 }
            );
            bySource.unpaywall = results.map(r => ({ ...r, source: 'unpaywall' }));
            debug('Unpaywall found %d papers', results.length);
          } catch (error) {
            debug('Unpaywall search failed: %s', error.message);
            bySource.unpaywall = [];
          }
        })
      );
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    return { bySource };
  }

  // Queue management for concurrent requests
  async executeWithQueue(task) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.requestQueue.shift();
    this.activeRequests++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue(); // Process next item in queue
    }
  }

  // Enrich results with additional metadata and PDFs
  async enrichResults(searchResults) {
    debug('Enriching results with metadata and PDFs');
    
    const allPapers = [];
    Object.values(searchResults.bySource).forEach(papers => {
      allPapers.push(...papers);
    });

    const enrichmentPromises = allPapers.map(async (paper, index) => {
      try {
        const enriched = { ...paper, originalIndex: index };

        // Enrich with Crossref metadata if we have a title
        if (paper.title && !paper.doi) {
          try {
            const crossrefData = await searchWorkByTitle(paper.title);
            if (crossrefData && crossrefData.DOI) {
              enriched.doi = crossrefData.DOI;
              enriched.crossrefData = crossrefData;
              debug('Enriched paper %d with Crossref DOI: %s', index, crossrefData.DOI);
            }
          } catch (error) {
            debug('Crossref enrichment failed for paper %d: %s', index, error.message);
          }
        }

        // Get open access PDF via Unpaywall
        if (enriched.doi && !enriched.pdfUrl) {
          try {
            const unpaywallData = await lookupByDOI(enriched.doi);
            if (unpaywallData && unpaywallData.oaUrl) {
              enriched.pdfUrl = unpaywallData.oaUrl;
              enriched.isOpenAccess = true;
              enriched.unpaywallData = unpaywallData;
              enriched.oaHostType = unpaywallData.hostType;
              debug('Found open access PDF for paper %d', index);
            }
          } catch (error) {
            debug('Unpaywall lookup failed for paper %d: %s', index, error.message);
          }
        }

        // Enrich with OpenAlex data if not already from OpenAlex
        if (paper.source !== 'openalex' && (paper.doi || paper.title)) {
          try {
            const openalexData = await openalex.enrichPaper(paper);
            if (openalexData) {
              enriched.openalexData = openalexData;
              // Update citation count if available
              if (openalexData.cited_by_count) {
                enriched.citationCount = openalexData.cited_by_count;
              }
              debug('Enriched paper %d with OpenAlex data', index);
            }
          } catch (error) {
            debug('OpenAlex enrichment failed for paper %d: %s', index, error.message);
          }
        }

        // Extract PDF content if available and not too large
        if (enriched.pdfUrl && options.extractPdfContent !== false) {
          try {
            const pdfData = await pdfProcessorService.processPDF(enriched.pdfUrl, { maxPages: 5 });
            if (pdfData && pdfData.text) {
              enriched.pdfContent = pdfData.text.substring(0, 3000); // Limit content size
              enriched.pdfMetadata = pdfData.metadata;
              debug('Extracted PDF content for paper %d (%d chars)', index, pdfData.text.length);
            }
          } catch (error) {
            debug('PDF extraction failed for paper %d: %s', index, error.message);
          }
        }

        return enriched;
      } catch (error) {
        debug('Enrichment failed for paper %d: %s', index, error.message);
        return { ...paper, originalIndex: index };
      }
    });

    // Process enrichments with concurrency limit
    const enriched = [];
    for (let i = 0; i < enrichmentPromises.length; i += 5) {
      const batch = enrichmentPromises.slice(i, i + 5);
      const batchResults = await Promise.all(batch);
      enriched.push(...batchResults);
      
      // Small delay between batches to be respectful to APIs
      if (i + 5 < enrichmentPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Additional batch enrichment with Unpaywall for papers without PDFs
    debug('Performing batch Unpaywall enrichment for %d papers', enriched.length);
    const papersWithoutPdfs = enriched.filter(p => !p.pdfUrl && p.doi);
    if (papersWithoutPdfs.length > 0) {
      try {
        const unpaywallEnriched = await enrichPapers(papersWithoutPdfs);
        // Update the original enriched papers with Unpaywall data
        unpaywallEnriched.forEach(paper => {
          const originalIndex = enriched.findIndex(p => p.doi === paper.doi);
          if (originalIndex !== -1) {
            enriched[originalIndex] = { ...enriched[originalIndex], ...paper };
          }
        });
        debug('Unpaywall batch enrichment completed for %d papers', unpaywallEnriched.length);
      } catch (error) {
        debug('Unpaywall batch enrichment failed: %s', error.message);
      }
    }

    return enriched;
  }

  // Advanced deduplication and ranking
  async deduplicateAndRank(papers, topic, maxResults) {
    debug('Deduplicating and ranking %d papers, will limit to %d', papers.length, maxResults);

    // Create similarity map for deduplication
    const seenKeys = new Set();
    const deduplicated = [];

    // Calculate relevance scores for all papers first
    papers.forEach(paper => {
      paper.relevanceScore = this.calculateRelevanceScore(paper, topic);
      paper.qualityScore = this.calculateQualityScore(paper);
    });

    // Sort by relevance score first with higher threshold for quality
    papers.sort((a, b) => {
      const scoreA = (a.relevanceScore * 0.7) + (a.qualityScore * 0.3);
      const scoreB = (b.relevanceScore * 0.7) + (b.qualityScore * 0.3);
      return scoreB - scoreA;
    });

    for (const paper of papers) {
      // Skip papers with very low relevance (less than 0.3)
      if (paper.relevanceScore < 0.3) {
        continue;
      }

      // Create deduplication key
      const doiKey = paper.doi ? `doi:${paper.doi.toLowerCase()}` : null;
      const titleKey = paper.title ? `title:${this.normalizeTitle(paper.title)}` : null;
      
      // Try DOI first, then title
      const key = doiKey || titleKey;
      
      if (!key || seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      
      // Track sources
      paper.sources = [paper.source];
      
      deduplicated.push(paper);
      
      // Stop if we've reached maxResults
      if (deduplicated.length >= maxResults) {
        debug('Reached maxResults limit of %d, stopping deduplication', maxResults);
        break;
      }
    }

    debug('After deduplication and filtering: %d papers (max: %d, min relevance: 0.3)', deduplicated.length, maxResults);
    return deduplicated;
  }

  // Calculate relevance score based on title/abstract matching
  calculateRelevanceScore(paper, topic) {
    const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
    const topicWords = topic.toLowerCase().split(/\s+/);
    
    let score = 0;
    let exactMatches = 0;
    let titleMatches = 0;
    let abstractMatches = 0;

    // Score individual word matches
    topicWords.forEach(word => {
      if (word.length > 2) {
        if (text.includes(word)) {
          score += 1;
          exactMatches += 1;
        }
        
        // Bonus for title matches (more important)
        if (paper.title && paper.title.toLowerCase().includes(word)) {
          titleMatches += 1;
          score += 2;
        }
        
        // Score for abstract matches
        if (paper.abstract && paper.abstract.toLowerCase().includes(word)) {
          abstractMatches += 1;
          score += 0.5;
        }
      }
    });

    // Strong bonus for exact phrase match
    if (text.includes(topic.toLowerCase())) {
      score += 5;
    }

    // Bonus for high word coverage
    const coverage = exactMatches / topicWords.length;
    if (coverage > 0.7) {
      score += 3;
    } else if (coverage > 0.5) {
      score += 1.5;
    }

    // Bonus for multiple keywords in title
    if (titleMatches > 1) {
      score += titleMatches * 1.5;
    }

    // For "reinforcement learning" specifically
    if (topic.toLowerCase().includes('reinforcement learning') || 
        topic.toLowerCase().includes('reinforcement') && topic.toLowerCase().includes('learning')) {
      if (text.includes('reinforcement learning') || 
          text.includes('reinforcement') && text.includes('learning') ||
          text.includes('rl') || text.includes('dqn') || text.includes('policy gradient') ||
          text.includes('q-learning') || text.includes('actor-critic')) {
        score += 8;
      }
    }

    // Normalize and cap score
    const normalizedScore = Math.min(score / Math.max(topicWords.length, 1), 10);
    return normalizedScore;
  }

  // Calculate quality score based on available metadata
  calculateQualityScore(paper) {
    let score = 0;

    // Has DOI
    if (paper.doi) score += 2;
    
    // Has abstract
    if (paper.abstract && paper.abstract.length > 100) score += 2;
    
    // Has citation count
    if (paper.citationCount && paper.citationCount > 0) {
      score += Math.min(Math.log10(paper.citationCount), 3);
    }
    
    // Has PDF
    if (paper.pdfUrl) score += 1;
    
    // Is open access
    if (paper.isOpenAccess) score += 1;
    
    // Has recent publication year
    if (paper.year && paper.year >= 2020) score += 1;
    
    // Has venue information
    if (paper.publication) score += 1;

    return score;
  }

  // Normalize title for deduplication
  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get enrichment statistics
  getEnrichmentStats(papers) {
    const stats = {
      totalPapers: papers.length,
      withDOI: papers.filter(p => p.doi).length,
      withPDF: papers.filter(p => p.pdfUrl).length,
      openAccess: papers.filter(p => p.isOpenAccess).length,
      withCitations: papers.filter(p => p.citationCount > 0).length,
      withPdfContent: papers.filter(p => p.pdfContent).length,
      crossrefEnriched: papers.filter(p => p.crossrefData).length,
      openalexEnriched: papers.filter(p => p.openalexData).length
    };

    stats.enrichmentRate = ((stats.withDOI + stats.withPDF) / (stats.totalPapers * 2) * 100).toFixed(1);
    
    return stats;
  }
}

module.exports = new EnhancedScrapingService();