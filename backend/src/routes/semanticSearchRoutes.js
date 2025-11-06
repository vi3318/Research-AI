const express = require('express');
const router = express.Router();
const {
  semanticSearch,
  getPaper,
  getAllPapers,
  deletePaper,
  getStats
} = require('../controllers/semanticSearchController');
const { requireAuth } = require('../middleware/auth');

/**
 * Semantic Search Routes
 * All routes are prefixed with /api/semantic-search
 */

// POST /api/semantic-search - Main semantic search endpoint
router.post('/', semanticSearch);

// GET /api/semantic-search/stats - Get indexing statistics
router.get('/stats', getStats);

// GET /api/papers - Get all papers with filters
router.get('/papers', getAllPapers);

// GET /api/papers/:id - Get single paper details
router.get('/papers/:id', getPaper);

// DELETE /api/papers/:id - Delete a paper (requires authentication)
router.delete('/papers/:id', requireAuth, deletePaper);

module.exports = router;
