const express = require('express');
const enhancedResearchController = require('../controllers/enhancedResearchController');
const { requireAuth, syncUser, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatResearchRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: Research query or question
 *         sessionId:
 *           type: string
 *           format: uuid
 *           description: Optional existing session ID
 *         analysisType:
 *           type: string
 *           enum: [basic, comprehensive]
 *           default: comprehensive
 *           description: Type of analysis to perform
 *     
 *     PaperAnalysisRequest:
 *       type: object
 *       required:
 *         - paperId
 *         - question
 *         - sessionId
 *       properties:
 *         paperId:
 *           type: string
 *           description: ID of the paper to analyze
 *         question:
 *           type: string
 *           description: Specific question about the paper
 *         sessionId:
 *           type: string
 *           format: uuid
 *           description: Session containing the paper
 *     
 *     ResearchGapVisualization:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *           format: uuid
 *         topic:
 *           type: string
 *         gapAnalysis:
 *           type: object
 *           properties:
 *             themes:
 *               type: array
 *               items:
 *                 type: object
 *             gaps:
 *               type: array
 *               items:
 *                 type: object
 *             visualizations:
 *               type: object
 */

/**
 * @swagger
 * /api/enhanced-research/chat:
 *   post:
 *     summary: Chat-first research workflow
 *     description: Perform comprehensive research based on a natural language query
 *     tags: [Enhanced Research]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatResearchRequest'
 *     responses:
 *       200:
 *         description: Research results with papers and analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 query:
 *                   type: string
 *                 summary:
 *                   type: string
 *                 papers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 gapAnalysis:
 *                   type: object
 *                 searchStats:
 *                   type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/chat', requireAuth, syncUser, (req, res) => enhancedResearchController.chatResearch(req, res));

/**
 * @swagger
 * /api/enhanced-research/analyze-paper:
 *   post:
 *     summary: Analyze specific paper with Q&A
 *     tags: [Enhanced Research]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paperId
 *               - question
 *               - sessionId
 *             properties:
 *               paperId:
 *                 type: string
 *                 description: Paper DOI or identifier
 *               question:
 *                 type: string
 *                 description: Question about the paper
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Chat session ID
 *     responses:
 *       200:
 *         description: Paper analysis generated
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/analyze-paper', requireAuth, syncUser, (req, res) => enhancedResearchController.analyzePaper(req, res));

/**
 * @swagger
 * /api/enhanced-research/gap-visualization:
 *   post:
 *     summary: Generate research gap visualization
 *     tags: [Enhanced Research]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Chat session ID
 *               visualizationType:
 *                 type: string
 *                 enum: [basic, comprehensive]
 *                 description: Type of visualization
 *     responses:
 *       200:
 *         description: Visualization generated
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/gap-visualization', requireAuth, syncUser, (req, res) => enhancedResearchController.generateGapVisualization(req, res));

/**
 * @swagger
 * /api/enhanced-research/generate-hypotheses:
 *   post:
 *     summary: Generate novel research hypotheses
 *     tags: [Enhanced Research]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Chat session ID
 *               researchArea:
 *                 type: string
 *                 description: Research area for hypothesis generation
 *     responses:
 *       200:
 *         description: Novel hypotheses generated successfully
 */
router.post('/generate-hypotheses', requireAuth, syncUser, (req, res) => enhancedResearchController.generateHypotheses(req, res));





/**
 * @swagger
 * /api/enhanced-research/opportunities:
 *   post:
 *     summary: Generate personalized research opportunities
 *     description: Create specific research opportunities based on session papers and user focus
 *     tags: [Enhanced Research]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               focusArea:
 *                 type: string
 *                 description: Specific area of interest (e.g., "machine learning", "healthcare applications")
 *     responses:
 *       200:
 *         description: Personalized research opportunities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 topic:
 *                   type: string
 *                 focusArea:
 *                   type: string
 *                 opportunities:
 *                   type: string
 *       400:
 *         description: No papers in session
 *       500:
 *         description: Opportunity generation failed
 */
router.post('/opportunities', requireAuth, syncUser, (req, res) => enhancedResearchController.generateOpportunities(req, res));

/**
 * @swagger
 * /api/enhanced-research/public-search:
 *   post:
 *     summary: Public research search (no auth required)
 *     description: Perform basic research search without session management
 *     tags: [Enhanced Research]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               maxResults:
 *                 type: integer
 *                 default: 10
 *               sources:
 *                 type: string
 *                 default: "scholar,arxiv,pubmed"
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 papers:
 *                   type: array
 *                 searchStats:
 *                   type: object
 */
router.post('/public-search', optionalAuth, async (req, res) => {
  try {
    const { query, maxResults = 10, sources } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const enhancedScrapingService = require('../services/enhancedScrapingService');
    
    const searchResults = await enhancedScrapingService.comprehensiveSearch(query, {
      maxResults: Math.min(maxResults, 20), // Cap results for public API
      sources,
      extractPdfContent: false // Disable PDF extraction for public API
    });

    res.json({
      query,
      papers: searchResults.results.slice(0, maxResults),
      searchStats: {
        totalFound: searchResults.totalFound,
        sources: searchResults.sources,
        enrichmentStats: searchResults.enrichmentStats
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Public search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

module.exports = router;