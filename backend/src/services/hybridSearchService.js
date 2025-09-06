const { store } = require("./vectorStoreService");
const bm25 = require("./bm25Service");

/**
 * Hybrid search: BM25 + embeddings cosine. Simple score fusion.
 */
function fuseScores(bm25Results, embedResults) {
  const wBm25 = Number(process.env.HYBRID_W_BM25 || 0.5);
  const wEmbed = Number(process.env.HYBRID_W_EMBED || 0.5);
  const map = new Map();
  for (const r of bm25Results) map.set(r.id, { bm25: r.score, embed: 0 });
  for (const r of embedResults) {
    const prev = map.get(r.id) || { bm25: 0, embed: 0 };
    map.set(r.id, { bm25: prev.bm25, embed: r.score });
  }
  return Array.from(map.entries()).map(([id, s]) => ({ id, score: wBm25 * s.bm25 + wEmbed * s.embed }));
}

function hybridQuery(namespace, query, topK = 10) {
  const bm = bm25.search(query, topK * 2);
  const qvec = store.query(namespace, [], 0); // no-op to assert store exists
  // we need embedding for query; handled at controller using embeddingsService
  return { bm, needsEmbedding: true };
}

module.exports = { fuseScores, hybridQuery };

