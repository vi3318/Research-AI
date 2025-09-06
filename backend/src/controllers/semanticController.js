const { v4: uuidv4 } = require("uuid");
const { embedText, embedPaper } = require("../services/embeddingsService");
const { store } = require("../services/vectorStoreService");
const bm25 = require("../services/bm25Service");
const { fuseScores } = require("../services/hybridSearchService");
const { asyncHandler, badRequest } = require("../utils/errorHandler");

/**
 * Index items into vector store
 * Body: { namespace: string, items: Array<{ id?: string, text?: string, paper?: object, metadata?: any }> }
 */
const indexItems = asyncHandler(async (req, res) => {
  const namespace = (req.body.namespace || "default").trim();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw badRequest("items array is required");

  // Clear existing BM25 index for this namespace to avoid duplicates
  console.log(`Clearing existing BM25 index for namespace: ${namespace}`);
  bm25.clearIndex();
  
  for (const item of items) {
    const id = item.id || uuidv4();
    let vector = [];
    if (item.text) {
      vector = await embedText(item.text);
    } else if (item.paper) {
      vector = await embedPaper(item.paper);
    } else {
      continue;
    }
    store.upsert(namespace, { id, vector, metadata: item.metadata || item.paper || { text: item.text } });
    // BM25 indexing - handle different data structures
    const m = item.metadata || item.paper || {};
    const textContent = item.text || m.text || m.abstract || m.description || '';
    const title = m.title || 'Untitled';
    const abstract = m.abstract || m.description || textContent.substring(0, 200);
    
    console.log(`Indexing document ${id}:`, { title, abstract: abstract.substring(0, 100) + '...', textLength: textContent.length });
    
    bm25.indexDoc(id, { 
      title: title, 
      abstract: abstract, 
      body: textContent 
    });
  }
  bm25.consolidate();
  res.status(200).json({ success: true });
});

/**
 * Query items from vector store
 * Body: { namespace: string, query: string, topK?: number }
 */
const queryItems = asyncHandler(async (req, res) => {
  const namespace = (req.body.namespace || "default").trim();
  const query = (req.body.query || "").trim();
  const topK = Number.isFinite(req.body.topK) ? req.body.topK : 5;
  if (!query) throw badRequest("query is required");
  
  console.log('Semantic query:', { namespace, query, topK });
  
  try {
    const qvec = await embedText(query);
    const embedResults = store.query(namespace, qvec, topK * 2);
    console.log('Embedding results:', embedResults.length);
    
    const bmResults = bm25.search(query, topK * 2);
    console.log('BM25 results:', bmResults.length);
    
    const fused = fuseScores(bmResults, embedResults).sort((a,b)=>b.score-a.score).slice(0, topK);
    // attach metadata
    const out = fused.map(r => ({ id: r.id, score: r.score, metadata: (store.namespaceToItems?.get?.(namespace) || []).find?.(i => i.id === r.id)?.metadata }));
    res.status(200).json({ results: out });
  } catch (error) {
    console.error('Semantic query error:', error);
    res.status(500).json({ error: 'Semantic query failed', details: error.message });
  }
});

/**
 * Get service status and statistics
 */
const getStatus = asyncHandler(async (req, res) => {
  try {
    const bm25Status = bm25.getStatus();
    const vectorStoreStatus = {
      namespaces: Array.from(store.namespaceToItems?.keys() || []),
      totalItems: Array.from(store.namespaceToItems?.values() || []).reduce((sum, items) => sum + items.length, 0)
    };
    
    res.json({
      bm25: bm25Status,
      vectorStore: vectorStoreStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Status check failed', details: error.message });
  }
});

module.exports = { indexItems, queryItems, getStatus };

