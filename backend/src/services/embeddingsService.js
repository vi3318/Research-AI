const { GoogleGenerativeAI } = require("@google/generative-ai");
const debug = require("debug")("researchai:embed");

// Load and validate API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

// Initialize Gemini embedding model
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Utility to clean input strings (e.g., remove HTML, collapse whitespace)
 * @param {string} str
 * @returns {string}
 */
const clean = (str) =>
  str.replace(/<[^>]+>/g, "") // remove HTML tags
     .replace(/\s+/g, " ")     // normalize whitespace
     .trim();

/**
 * Generate embedding vector for input text
 * @param {string} text
 * @returns {Promise<number[]>}
 */
const embedText = async (text) => {
  if (!text || !text.trim()) {
    debug("Empty or invalid text for embedding.");
    return [];
  }

  const clipped = text.length > 8000 ? text.slice(0, 8000) : text;

  try {
    const result = await embeddingModel.embedContent({
      content: {
        parts: [{ text: clipped }]
      }
    });

    const values = result?.embedding?.values || [];
    debug("Generated embedding of length %d", values.length);
    return values;
  } catch (err) {
    debug("Embedding error: %O", err);
    throw new Error(`Failed to generate embeddings: ${err.message}`);
  }
};

/**
 * Construct a representative text block from a paper's metadata and content
 * @param {{title?: string, abstract?: string, fullText?: string, authors?: string, year?: string}} paper
 * @returns {string}
 */
const buildPaperText = (paper) => {
  const parts = [];

  if (paper?.title) parts.push(`Title: ${clean(paper.title)}`);
  if (paper?.authors) parts.push(`Authors: ${clean(paper.authors)}`);
  if (paper?.year) parts.push(`Year: ${clean(String(paper.year))}`);
  if (paper?.abstract) parts.push(`Abstract: ${clean(paper.abstract)}`);
  if (paper?.fullText) {
    const maxLength = 5000;
    const fullText = clean(paper.fullText);
    parts.push(`FullText: ${fullText.length > maxLength ? fullText.slice(0, maxLength) + "..." : fullText}`);
  }

  return parts.join("\n\n");
};

/**
 * Generate an embedding vector for a paper object
 * @param {object} paper
 * @returns {Promise<number[]>}
 */
const embedPaper = async (paper) => {
  const text = buildPaperText(paper);
  return embedText(text);
};

// Exports
module.exports = {
  embedText,
  embedPaper,
  buildPaperText,
};
