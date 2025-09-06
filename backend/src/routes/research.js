const express = require("express");
const {
  startResearch,
  getResearchStatus,
  getResearchResults,
} = require("../controllers/researchController");
const { optionalAuth, syncUser, requireAuth } = require("../middleware/auth");
const enhancedScrapingService = require("../services/enhancedScrapingService");

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.log(`Research route hit: ${req.method} ${req.path}`);
  next();
});

/**
 * @route   POST /api/research
 * @desc    Start a new research job
 * @access  Public (optional auth)
 */
router.post("/", optionalAuth, syncUser, startResearch);

/**
 * @route   GET /api/research/status/:jobId
 * @desc    Get status of a research job
 * @access  Public
 */
router.get("/status/:jobId", getResearchStatus);

/**
 * @route   GET /api/research/results/:jobId
 * @desc    Get results of a completed research job
 * @access  Public
 */
router.get("/results/:jobId", getResearchResults);

/**
 * @route   POST /api/research/search
 * @desc    Direct search endpoint used by EnhancedChat component
 * @access  Protected
 */
router.post("/search", requireAuth, syncUser, async (req, res) => {
  try {
    console.log("Direct search endpoint hit:", req.body);
    const { query, limit = 40 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: true,
        message: 'Valid search query is required'
      });
    }

    console.log(`🔍 Processing search request for: "${query}" with limit: ${limit}`);

    // Record start time to measure search performance
    const startTime = Date.now();

    // Use the enhanced scraping service
    const searchResults = await enhancedScrapingService.comprehensiveSearch(query, {
      maxResults: limit,
      sources: 'scholar,arxiv,pubmed,openalex,unpaywall',
      extractPdfContent: false // Disable PDF extraction to speed up
    });

    // Calculate search time
    const searchTime = Date.now() - startTime;

    console.log(`✅ Search completed in ${searchTime}ms. Found ${searchResults.results.length} papers`);
    console.log('Sources used:', searchResults.sources);
    console.log('Papers by source:', Object.keys(searchResults.bySource).map(source => 
      `${source}: ${(searchResults.bySource[source] || []).length}`
    ).join(', '));

    // Format response expected by the frontend
    res.json({
      success: true,
      query: searchResults.query,
      papers: searchResults.results,
      totalFound: searchResults.totalFound,
      sources: searchResults.sources,
      searchTime,
      bySource: searchResults.bySource
    });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      error: true,
      message: `Search failed: ${error.message}`
    });
  }
});

module.exports = router;
