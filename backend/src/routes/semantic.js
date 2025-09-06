const express = require("express");
const { indexItems, queryItems, getStatus } = require("../controllers/semanticController");
const { asyncHandler, badRequest } = require("../utils/errorHandler");
const { store } = require("../services/vectorStoreService");
const { embedText } = require("../services/embeddingsService");
const gemini = require("../services/geminiService");

const router = express.Router();

/**
 * @route   POST /api/semantic/index
 * @desc    Index text items into vector store
 * @access  Public
 */
router.post("/index", indexItems);

/**
 * @route   POST /api/semantic/query
 * @desc    Query similar items from vector store
 * @access  Public
 */
router.post("/query", queryItems);

/**
 * @route   GET /api/semantic/status
 * @desc    Get semantic search service status
 * @access  Public
 */
router.get("/status", getStatus);

/**
 * @route   POST /api/semantic/qa
 * @desc    RAG-style Q&A over indexed namespace with citations
 * @access  Public
 */
router.post("/qa", asyncHandler(async (req, res) => {
  const namespace = (req.body.namespace || "default").trim();
  const question = (req.body.question || "").trim();
  const topK = Number.isFinite(req.body.topK) ? req.body.topK : 5;
  if (!question) throw badRequest("question is required");
  const qvec = await embedText(question);
  const hits = store.query(namespace, qvec, topK);
  const answer = await gemini.answerQuestionWithContexts(question, hits.map(h => h.metadata || {}));
  res.status(200).json({ answer, contexts: hits });
}));

module.exports = router;

