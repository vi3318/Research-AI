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

/**
 * @route   POST /api/research/qa-assistant
 * @desc    QA Assistant endpoint for research guidance using Gemini
 * @access  Protected
 */
router.post("/qa-assistant", requireAuth, syncUser, async (req, res) => {
  try {
    console.log("QA Assistant endpoint hit:", req.body);
    const { question, context = 'research_guidance' } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        error: true, 
        message: 'Question is required and must be a string' 
      });
    }

    // Import Gemini service
    const geminiService = require("../services/geminiService");
    
    // Create a research-focused prompt
    const researchPrompt = `You are a professional research assistant AI with expertise across all academic disciplines. Your role is to provide helpful, accurate, and actionable guidance to researchers at all levels.

Context: The user is seeking ${context} assistance.

User Question: ${question}

Please provide a comprehensive, well-structured response that:
- Directly addresses their question
- Offers practical, actionable advice
- Includes relevant examples where helpful
- Suggests next steps or further considerations
- Maintains an encouraging and supportive tone
- Uses markdown formatting for better readability

Focus on being informative, encouraging, and practical in your response.`;

    const response = await geminiService.generateContent(researchPrompt);
    
    res.json({
      success: true,
      answer: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("QA Assistant error:", error);
    res.status(500).json({
      error: true,
      message: `QA Assistant failed: ${error.message}`
    });
  }
});

/**
 * @route   POST /api/research/analyze-paper
 * @desc    Analyze a specific paper with Q&A using RAG
 * @access  Protected
 */
router.post("/analyze-paper", requireAuth, syncUser, async (req, res) => {
  try {
    console.log("Analyze paper endpoint hit:", req.body);
    const { paper, sessionId } = req.body;
    
    if (!paper) {
      return res.status(400).json({ 
        error: true, 
        message: 'Paper data is required' 
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        error: true, 
        message: 'Session ID is required' 
      });
    }

    // Import the enhanced research controller
    const enhancedResearchController = require("../controllers/enhancedResearchController");
    
    // Create a comprehensive paper ID for matching
    const paperId = paper.doi || paper.url || paper.paper_id || paper.title;
    
    console.log('Analyzing paper with ID:', paperId);
    console.log('Paper title:', paper.title);
    console.log('Session ID:', sessionId);
    
    // Transform the request to match the controller's expected format
    const transformedReq = {
      ...req,
      body: {
        paperId: paperId,
        question: paper.question || "Please provide a comprehensive analysis of this paper including its main contributions, methodology, and findings.",
        sessionId: sessionId
      }
    };

    // Use the existing controller
    await enhancedResearchController.analyzePaper(transformedReq, res);

  } catch (error) {
    console.error("Analyze paper error:", error);
    res.status(500).json({
      error: true,
      message: `Paper analysis failed: ${error.message}`
    });
  }
});

module.exports = router;
