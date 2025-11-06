const { HfInference } = require('@huggingface/inference');

/**
 * Paper Embedding Service using HuggingFace Inference API
 * Model: sentence-transformers/all-mpnet-base-v2 (768 dimensions)
 * Alternative: intfloat/e5-large-v2
 */
class PaperEmbeddingService {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    this.model = 'sentence-transformers/all-mpnet-base-v2';
    this.dimensions = 768;
    
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.warn('[Embeddings] WARNING: HUGGINGFACE_API_KEY not set in environment variables');
      console.warn('[Embeddings] Get your free API key from: https://huggingface.co/settings/tokens');
    }
  }

  /**
   * Generate embedding for a text query
   * @param {string} text - Query text
   * @returns {Promise<number[]>} - 768-dimensional embedding vector
   */
  async embedQuery(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      console.log(`[Embeddings] Generating embedding for query: "${text.substring(0, 50)}..."`);
      
      const embedding = await this.hf.featureExtraction({
        model: this.model,
        inputs: text
      });

      // HuggingFace returns a nested array, flatten it
      const vector = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      
      if (vector.length !== this.dimensions) {
        throw new Error(`Expected ${this.dimensions} dimensions, got ${vector.length}`);
      }

      console.log(`[Embeddings] Successfully generated ${vector.length}-dimensional vector`);
      return vector;

    } catch (error) {
      console.error('[Embeddings] Error generating query embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate embedding for a paper document
   * Combines title and abstract for better semantic representation
   * @param {Object} paper - Paper object with title, abstract, authors
   * @returns {Promise<number[]>} - 768-dimensional embedding vector
   */
  async embedPaper(paper) {
    try {
      const { title, abstract, authors } = paper;

      if (!title) {
        throw new Error('Paper must have a title');
      }

      // Construct a rich text representation
      // Format: "Title. Authors: [authors]. Abstract: [abstract]"
      let text = title;
      
      if (authors) {
        text += `. Authors: ${authors}`;
      }
      
      if (abstract) {
        // Truncate abstract to avoid token limits (~512 tokens max for most models)
        const truncatedAbstract = abstract.substring(0, 1500);
        text += `. Abstract: ${truncatedAbstract}`;
      }

      console.log(`[Embeddings] Generating embedding for paper: "${title.substring(0, 50)}..."`);
      
      const embedding = await this.hf.featureExtraction({
        model: this.model,
        inputs: text
      });

      const vector = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      
      if (vector.length !== this.dimensions) {
        throw new Error(`Expected ${this.dimensions} dimensions, got ${vector.length}`);
      }

      console.log(`[Embeddings] Successfully generated paper embedding`);
      return vector;

    } catch (error) {
      console.error('[Embeddings] Error generating paper embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple papers in batch
   * @param {Array<Object>} papers - Array of paper objects
   * @returns {Promise<Array<number[]>>} - Array of embedding vectors
   */
  async embedPapersBatch(papers) {
    try {
      console.log(`[Embeddings] Generating embeddings for ${papers.length} papers (batch mode)`);
      
      const embeddings = [];
      
      // Process in smaller batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < papers.length; i += batchSize) {
        const batch = papers.slice(i, i + batchSize);
        console.log(`[Embeddings] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(papers.length/batchSize)}`);
        
        const batchPromises = batch.map(paper => this.embedPaper(paper));
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < papers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[Embeddings] Successfully generated ${embeddings.length} embeddings`);
      return embeddings;

    } catch (error) {
      console.error('[Embeddings] Error in batch embedding:', error.message);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Similarity score between 0 and 1
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get model information
   * @returns {Object} - Model metadata
   */
  getModelInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      maxTokens: 512,
      provider: 'HuggingFace',
      description: 'Sentence-transformers all-mpnet-base-v2 - high quality semantic embeddings'
    };
  }
}

module.exports = new PaperEmbeddingService();
