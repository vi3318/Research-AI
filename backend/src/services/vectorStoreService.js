const debug = require("debug")("researchai:vstore");

/**
 * Simple in-memory vector store with cosine similarity
 */
class InMemoryVectorStore {
  constructor() {
    /** @type {Map<string, Array<{id: string, vector: number[], metadata: any}>>} */
    this.namespaceToItems = new Map();
  }

  /**
   * Upsert a vector item
   * @param {string} namespace
   * @param {{id: string, vector: number[], metadata: any}} item
   */
  upsert(namespace, item) {
    if (!this.namespaceToItems.has(namespace)) this.namespaceToItems.set(namespace, []);
    const items = this.namespaceToItems.get(namespace);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.push(item);
    debug("Upserted item %s in namespace %s", item.id, namespace);
  }

  /**
   * Query for nearest neighbors
   * @param {string} namespace
   * @param {number[]} queryVector
   * @param {number} topK
   */
  query(namespace, queryVector, topK = 5) {
    const items = this.namespaceToItems.get(namespace) || [];
    const scored = items.map((i) => ({ item: i, score: cosineSimilarity(i.vector, queryVector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ item, score }) => ({ id: item.id, metadata: item.metadata, score }));
    return scored;
  }

  /**
   * Delete item by id
   */
  delete(namespace, id) {
    const items = this.namespaceToItems.get(namespace) || [];
    const filtered = items.filter((i) => i.id !== id);
    this.namespaceToItems.set(namespace, filtered);
  }

  /**
   * Clear a namespace
   */
  clear(namespace) {
    this.namespaceToItems.delete(namespace);
  }
}

/**
 * Cosine similarity between vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Export singleton for now
const store = new InMemoryVectorStore();

module.exports = { store, InMemoryVectorStore };

