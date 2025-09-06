const bm25 = require("wink-bm25-text-search");

let engine = bm25();
let initialized = false;

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function init() {
  if (initialized) return;
  engine.defineConfig({ fldWeights: { title: 3, abstract: 2, body: 1 } });
  // Use a minimal, safe pipeline. We already normalize strings ourselves.
  engine.definePrepTasks([]);
  initialized = true;
}

function indexDoc(id, fields) {
  init();
  const doc = { 
    id, 
    body: normalize(fields.body || ""), 
    title: normalize(fields.title || ""), 
    abstract: normalize(fields.abstract || "") 
  };
  
  console.log(`BM25: Indexing document ${id}`, {
    titleLength: doc.title.length,
    abstractLength: doc.abstract.length,
    bodyLength: doc.body.length
  });
  
  engine.addDoc(doc);
}

function consolidate() {
  init();
  if (engine.getTotalDocs() > 0) {
    engine.consolidate();
    console.log(`BM25 consolidated ${engine.getTotalDocs()} documents`);
  }
}

function clearIndex() {
  init();
  // Reset the engine safely
  engine = bm25();
  initialized = false;
  init(); // Reinitialize with config and prep tasks
  console.log('BM25 index cleared and reset');
}

function search(query, limit = 10) {
  init();
  if (!engine.getTotalDocs() || engine.getTotalDocs() === 0) {
    console.log('BM25: No documents indexed, returning empty results');
    return [];
  }
  
  try {
    const results = engine.search(normalize(query));
    return results.slice(0, limit).map(r => ({ id: r[0], score: r[1] }));
  } catch (error) {
    console.error('BM25 search error:', error);
    return [];
  }
}

function getStatus() {
  return {
    initialized,
    totalDocs: engine.getTotalDocs(),
    ready: initialized && engine.getTotalDocs() > 0
  };
}

module.exports = { indexDoc, consolidate, search, getStatus, clearIndex };

