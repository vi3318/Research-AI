const express = require('express');
const router = express.Router();
const citationController = require('../controllers/citationController');
const { requireAuth } = require('../middleware/auth');
const { citationRateLimit } = require('../middleware/rateLimiting');

// Generate citation for specific style
router.post('/generate', requireAuth, citationRateLimit, citationController.generateCitation);

// Generate citations in all supported styles
router.post('/generate-all', requireAuth, citationRateLimit, citationController.generateAllCitations);

// Get supported citation styles (public)
router.get('/styles', citationController.getSupportedStyles);

// Generate citation from paper ID (future implementation)
router.get('/paper/:id', requireAuth, citationRateLimit, citationController.generateCitationFromId);

// Validate paper data for citation generation
router.post('/validate', requireAuth, citationController.validatePaperData);

// Get citation statistics
router.get('/stats', requireAuth, citationController.getCitationStats);

// Get popular papers based on citations
router.get('/popular', requireAuth, citationController.getPopularPapers);

// Search papers in database
router.post('/search', requireAuth, citationController.searchPapers);

module.exports = router;
