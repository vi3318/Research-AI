const express = require("express");
const { searchLiterature } = require("../controllers/literatureController");

const router = express.Router();

/**
 * GET /api/literature/search?topic=...&sources=scholar,arxiv,pubmed&maxResults=10
 */
router.get("/search", searchLiterature);

module.exports = router;