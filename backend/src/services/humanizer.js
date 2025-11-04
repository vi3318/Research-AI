/**
 * Humanizer Service
 * Wraps LLM clients with pre/post processing
 * - Pre-processing: Clean input, remove long references
 * - Post-processing: Grammar checks, regex tweaks
 * - Returns: { rewritten, provider, latency_ms, quality_score }
 */

const llmClients = require('./llmClients');
const debug = require('debug')('researchai:humanizer');

class HumanizerService {
  constructor() {
    // Grammar patterns for post-processing
    this.grammarFixes = [
      // Fix common grammar issues
      [/\s+([,.])/g, '$1'], // Remove space before punctuation
      [/([.!?])\s*([a-z])/g, '$1 $2'], // Ensure space after sentence end
      [/\s{2,}/g, ' '], // Remove multiple spaces
      [/^(\s+)/g, ''], // Remove leading whitespace
      [/(\s+)$/g, ''], // Remove trailing whitespace
      
      // Fix common AI writing patterns
      [/\b(very|really|quite|somewhat)\s+/gi, ''], // Remove weak intensifiers
      [/\b(basically|essentially|actually)\b/gi, ''], // Remove filler words
      
      // Improve flow
      [/\.\s+Additionally,/gi, '. Also,'],
      [/\.\s+Furthermore,/gi, '. Moreover,'],
      [/\.\s+In addition,/gi, '. Plus,']
    ];

    // Reference patterns to remove/shorten
    this.referencePatterns = [
      /\[\d+\]/g, // Citation numbers [1], [2]
      /\([A-Za-z]+\s+et\s+al\.,?\s+\d{4}\)/g, // Author citations (Smith et al., 2020)
      /\(see\s+[^)]+\)/gi, // See references
    ];

    // Stopwords for cleaning
    this.stopwordsToRemove = new Set([
      'basically', 'essentially', 'literally', 'actually', 'technically'
    ]);
  }

  /**
   * Pre-process text before sending to LLM
   * - Remove excessive whitespace
   * - Shorten or remove references
   * - Clean up formatting
   */
  preProcess(text) {
    let cleaned = text;

    // Remove inline citations but keep the text
    this.referencePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove any markdown/HTML artifacts
    cleaned = cleaned.replace(/<[^>]+>/g, ''); // HTML tags
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold **text**
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic *text*
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // Code `text`

    // Limit length (safety check)
    const maxLength = 8000; // ~2000 tokens
    if (cleaned.length > maxLength) {
      debug(`Text truncated from ${cleaned.length} to ${maxLength} chars`);
      cleaned = cleaned.substring(0, maxLength) + '...';
    }

    debug(`Pre-processed: ${text.length} → ${cleaned.length} chars`);
    
    return cleaned;
  }

  /**
   * Post-process LLM output
   * - Apply grammar fixes
   * - Remove filler words
   * - Improve readability
   */
  postProcess(text) {
    let improved = text;

    // Apply grammar fixes
    this.grammarFixes.forEach(([pattern, replacement]) => {
      improved = improved.replace(pattern, replacement);
    });

    // Remove excessive punctuation
    improved = improved.replace(/[!]{2,}/g, '!'); // Multiple exclamations
    improved = improved.replace(/[?]{2,}/g, '?'); // Multiple questions
    improved = improved.replace(/\.{4,}/g, '...'); // Multiple dots to ellipsis

    // Fix capitalization after punctuation
    improved = improved.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
      return punct + ' ' + letter.toUpperCase();
    });

    // Capitalize first letter
    if (improved.length > 0) {
      improved = improved[0].toUpperCase() + improved.slice(1);
    }

    debug(`Post-processed: applied ${this.grammarFixes.length} grammar rules`);
    
    return improved.trim();
  }

  /**
   * Calculate quality score for humanized text
   * Based on:
   * - Length preservation (should be similar to original)
   * - Sentence variety
   * - Word diversity
   */
  calculateQualityScore(original, rewritten) {
    let score = 100;

    // Penalize large length changes (>30%)
    const lengthRatio = rewritten.length / original.length;
    if (lengthRatio < 0.7 || lengthRatio > 1.3) {
      score -= 20;
      debug(`Length ratio penalty: ${lengthRatio.toFixed(2)}`);
    }

    // Check sentence variety (different lengths)
    const sentences = rewritten.split(/[.!?]+/).filter(s => s.trim());
    const avgSentenceLength = rewritten.length / (sentences.length || 1);
    const sentenceLengths = sentences.map(s => s.length);
    const variance = sentenceLengths.reduce((sum, len) => {
      return sum + Math.pow(len - avgSentenceLength, 2);
    }, 0) / (sentences.length || 1);
    
    if (variance < 100) {
      score -= 10; // Sentences too uniform
      debug('Sentence variety penalty: low variance');
    }

    // Check for AI-like patterns (penalize)
    const aiPatterns = [
      /In conclusion,/gi,
      /To sum up,/gi,
      /In summary,/gi,
      /It is important to note/gi,
      /It should be noted/gi
    ];
    
    aiPatterns.forEach(pattern => {
      if (pattern.test(rewritten)) {
        score -= 5;
        debug(`AI pattern detected: ${pattern}`);
      }
    });

    // Bonus for natural transitions
    const naturalTransitions = [
      /But\s/gi,
      /So\s/gi,
      /And\s/gi,
      /Or\s/gi
    ];
    
    let transitionCount = 0;
    naturalTransitions.forEach(pattern => {
      const matches = rewritten.match(pattern);
      if (matches) transitionCount += matches.length;
    });
    
    if (transitionCount > sentences.length * 0.2) {
      score += 5; // Good use of transitions
      debug(`Natural transitions bonus: ${transitionCount} found`);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Main humanize method
   * @param {string} text - Text to humanize
   * @param {Object} options - Configuration
   * @param {string} options.provider - LLM provider to use
   * @param {number} options.temperature - Sampling temperature
   * @param {boolean} options.skipPreProcess - Skip pre-processing
   * @param {boolean} options.skipPostProcess - Skip post-processing
   * @returns {Promise<Object>} { rewritten, original, provider, latency_ms, quality_score, changes }
   */
  async humanize(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // Pre-process
      const cleanedText = options.skipPreProcess 
        ? text 
        : this.preProcess(text);

      debug(`Humanizing ${cleanedText.length} chars with provider: ${options.provider || 'auto'}`);

      // Call LLM
      const llmResult = await llmClients.humanizeText(cleanedText, {
        provider: options.provider,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 2000,
        maxRetries: options.maxRetries || 3
      });

      // Post-process
      const finalText = options.skipPostProcess
        ? llmResult.rewritten
        : this.postProcess(llmResult.rewritten);

      // Calculate quality
      const qualityScore = this.calculateQualityScore(cleanedText, finalText);

      const totalLatency = Date.now() - startTime;

      return {
        rewritten: finalText,
        original: text,
        provider: llmResult.provider,
        model: llmResult.model,
        latency_ms: totalLatency,
        llm_latency_ms: llmResult.latency_ms,
        quality_score: qualityScore,
        usage: llmResult.usage,
        changes: {
          original_length: text.length,
          cleaned_length: cleanedText.length,
          final_length: finalText.length,
          length_ratio: (finalText.length / text.length).toFixed(2)
        }
      };

    } catch (error) {
      debug(`Humanization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch humanize multiple texts
   * @param {string[]} texts - Array of texts to humanize
   * @param {Object} options - Configuration
   * @param {number} options.concurrency - Max concurrent requests (default: 3)
   * @returns {Promise<Object[]>} Array of humanization results
   */
  async humanizeBatch(texts, options = {}) {
    const concurrency = options.concurrency || 3;
    const results = [];
    
    debug(`Batch humanizing ${texts.length} texts with concurrency ${concurrency}`);

    // Process in chunks
    for (let i = 0; i < texts.length; i += concurrency) {
      const chunk = texts.slice(i, i + concurrency);
      const chunkPromises = chunk.map(text => this.humanize(text, options));
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      results.push(...chunkResults.map((result, idx) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            error: result.reason.message,
            original: chunk[idx],
            provider: 'error',
            latency_ms: 0
          };
        }
      }));

      debug(`Processed chunk ${i / concurrency + 1}/${Math.ceil(texts.length / concurrency)}`);
    }

    return results;
  }

  /**
   * Get humanizer health and stats
   */
  async getHealth() {
    const providersHealth = llmClients.getHealthStatus();
    
    return {
      status: 'healthy',
      providers: providersHealth,
      features: {
        preProcessing: true,
        postProcessing: true,
        qualityScoring: true,
        batchProcessing: true
      }
    };
  }
}

// Export singleton
const humanizerService = new HumanizerService();

module.exports = {
  humanizerService,
  HumanizerService
};
