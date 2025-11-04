/**
 * Confidence Calculation Service
 * 
 * Computes normalized confidence scores for RMRI agents by combining:
 * - Provider confidence (from LLM ensemble)
 * - Similarity agreement (between multiple providers)
 * - Evidence count weighting (number of supporting sources)
 * - Output quality metrics
 */

class ConfidenceCalculator {
  constructor() {
    this.weights = {
      providerConfidence: 0.35,
      similarityAgreement: 0.30,
      evidenceCount: 0.20,
      outputQuality: 0.15
    };

    this.thresholds = {
      highConfidence: 0.75,
      mediumConfidence: 0.50,
      lowConfidence: 0.30
    };
  }

  /**
   * Calculate normalized confidence score
   * 
   * @param {object} options - Configuration
   * @param {number} options.providerConfidence - Average confidence from LLM providers (0-1)
   * @param {number} options.similarityAgreement - Agreement between providers (0-1)
   * @param {number} options.evidenceCount - Number of supporting papers/sources
   * @param {object} options.output - The generated output to analyze
   * @param {number} options.maxEvidence - Maximum expected evidence count (for normalization)
   * @returns {object} Confidence breakdown and final score
   */
  calculateConfidence(options = {}) {
    const {
      providerConfidence = 0.5,
      similarityAgreement = 0.5,
      evidenceCount = 0,
      output = null,
      maxEvidence = 10
    } = options;

    // 1. Provider Confidence Component (35%)
    const providerScore = this._normalizeScore(providerConfidence);

    // 2. Similarity Agreement Component (30%)
    const agreementScore = this._calculateAgreementScore(similarityAgreement);

    // 3. Evidence Count Component (20%)
    const evidenceScore = this._calculateEvidenceScore(evidenceCount, maxEvidence);

    // 4. Output Quality Component (15%)
    const qualityScore = output ? this._calculateOutputQuality(output) : 0.5;

    // Weighted combination
    const finalScore = 
      (providerScore * this.weights.providerConfidence) +
      (agreementScore * this.weights.similarityAgreement) +
      (evidenceScore * this.weights.evidenceCount) +
      (qualityScore * this.weights.outputQuality);

    const normalizedScore = Math.min(Math.max(finalScore, 0.0), 1.0);

    return {
      finalConfidence: normalizedScore,
      confidenceLevel: this._getConfidenceLevel(normalizedScore),
      breakdown: {
        providerConfidence: {
          score: providerScore,
          weight: this.weights.providerConfidence,
          contribution: providerScore * this.weights.providerConfidence
        },
        similarityAgreement: {
          score: agreementScore,
          weight: this.weights.similarityAgreement,
          contribution: agreementScore * this.weights.similarityAgreement
        },
        evidenceCount: {
          score: evidenceScore,
          weight: this.weights.evidenceCount,
          contribution: evidenceScore * this.weights.evidenceCount,
          rawCount: evidenceCount
        },
        outputQuality: {
          score: qualityScore,
          weight: this.weights.outputQuality,
          contribution: qualityScore * this.weights.outputQuality
        }
      },
      metadata: {
        isReliable: normalizedScore >= this.thresholds.mediumConfidence,
        needsVerification: normalizedScore < this.thresholds.mediumConfidence,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate confidence for ensemble LLM results
   */
  calculateEnsembleConfidence(ensembleResult) {
    if (!ensembleResult || !ensembleResult.providers) {
      return this.calculateConfidence({ providerConfidence: 0.3 });
    }

    const avgProviderConf = ensembleResult.confidence || 0.5;
    const similarity = ensembleResult.metrics?.averageSimilarity || 0.5;
    const providerCount = ensembleResult.providers?.length || 1;

    return this.calculateConfidence({
      providerConfidence: avgProviderConf,
      similarityAgreement: similarity,
      evidenceCount: providerCount,
      output: ensembleResult.output,
      maxEvidence: 3 // Max 3 providers
    });
  }

  /**
   * Calculate confidence for micro agent output
   */
  calculateMicroAgentConfidence(microOutput) {
    const {
      providerConfidence = 0.5,
      extractedSections = [],
      contributions = [],
      limitations = [],
      researchGaps = []
    } = microOutput;

    // Evidence count = sections found + contributions + gaps
    const evidenceCount = 
      extractedSections.length +
      contributions.length +
      limitations.length +
      researchGaps.length;

    return this.calculateConfidence({
      providerConfidence,
      similarityAgreement: 0.7, // Single paper, no comparison
      evidenceCount,
      output: microOutput,
      maxEvidence: 20
    });
  }

  /**
   * Calculate confidence for meso agent output
   */
  calculateMesoAgentConfidence(mesoOutput) {
    const {
      providerConfidence = 0.5,
      clusters = [],
      patterns = [],
      thematicGaps = []
    } = mesoOutput;

    // Evidence = clusters found + patterns + gaps
    const evidenceCount = clusters.length + patterns.length + thematicGaps.length;

    // Agreement = average cluster cohesion
    const avgCohesion = clusters.length > 0
      ? clusters.reduce((sum, c) => sum + (c.cohesion || 0), 0) / clusters.length
      : 0.5;

    return this.calculateConfidence({
      providerConfidence,
      similarityAgreement: avgCohesion,
      evidenceCount,
      output: mesoOutput,
      maxEvidence: 15
    });
  }

  /**
   * Calculate confidence for meta agent output
   */
  calculateMetaAgentConfidence(metaOutput, previousIterationOutput = null) {
    const {
      providerConfidence = 0.5,
      rankedGaps = [],
      crossDomainPatterns = [],
      researchFrontiers = []
    } = metaOutput;

    // Evidence = ranked gaps + patterns + frontiers
    const evidenceCount = rankedGaps.length + crossDomainPatterns.length + researchFrontiers.length;

    // Agreement = convergence similarity (if available)
    let agreementScore = 0.5;
    if (previousIterationOutput && metaOutput.convergence) {
      agreementScore = metaOutput.convergence.similarity || 0.5;
    }

    return this.calculateConfidence({
      providerConfidence,
      similarityAgreement: agreementScore,
      evidenceCount,
      output: metaOutput,
      maxEvidence: 25
    });
  }

  /**
   * Normalize score to 0-1 range
   */
  _normalizeScore(value) {
    return Math.min(Math.max(value, 0.0), 1.0);
  }

  /**
   * Calculate agreement score with bonuses for high agreement
   */
  _calculateAgreementScore(similarity) {
    const normalized = this._normalizeScore(similarity);
    
    // Bonus for high agreement (exponential boost)
    if (normalized > 0.7) {
      return normalized + ((normalized - 0.7) * 0.5);
    }
    
    // Penalty for low agreement
    if (normalized < 0.3) {
      return normalized * 0.5;
    }
    
    return normalized;
  }

  /**
   * Calculate evidence count score with diminishing returns
   */
  _calculateEvidenceScore(count, maxExpected) {
    if (count === 0) return 0.0;
    if (maxExpected === 0) return 0.5;

    // Logarithmic scaling (diminishing returns)
    const normalized = count / maxExpected;
    const score = Math.log(1 + normalized) / Math.log(2);

    return this._normalizeScore(score);
  }

  /**
   * Calculate output quality based on structure and content
   */
  _calculateOutputQuality(output) {
    if (!output) return 0.0;

    const text = typeof output === 'string' ? output : JSON.stringify(output);
    let qualityScore = 0.5; // Base score

    // Length check (reasonable output)
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 100 && wordCount < 5000) {
      qualityScore += 0.15;
    } else if (wordCount < 20) {
      qualityScore -= 0.2;
    }

    // Structure checks
    if (typeof output === 'object') {
      // JSON structure bonus
      qualityScore += 0.1;

      // Check for expected fields
      const hasExpectedFields = 
        output.contributions || 
        output.gaps || 
        output.patterns || 
        output.clusters;
      
      if (hasExpectedFields) qualityScore += 0.1;
    }

    // Content quality (for text outputs)
    if (typeof output === 'string') {
      // Has structure (bullets, sections)
      if (/[-•*]\s/.test(text)) qualityScore += 0.1;
      
      // Has citations or references
      if (/\[\d+\]|\(\d{4}\)/.test(text)) qualityScore += 0.05;
      
      // Has academic keywords
      const academicKeywords = ['research', 'study', 'findings', 'methodology', 'analysis', 'evidence'];
      const keywordMatches = academicKeywords.filter(kw => 
        text.toLowerCase().includes(kw)
      ).length;
      qualityScore += (keywordMatches / academicKeywords.length) * 0.1;
    }

    return this._normalizeScore(qualityScore);
  }

  /**
   * Get confidence level label
   */
  _getConfidenceLevel(score) {
    if (score >= this.thresholds.highConfidence) return 'high';
    if (score >= this.thresholds.mediumConfidence) return 'medium';
    if (score >= this.thresholds.lowConfidence) return 'low';
    return 'very_low';
  }

  /**
   * Aggregate confidence from multiple items
   * Used for aggregating micro agent confidences into meso, etc.
   */
  aggregateConfidences(confidences, method = 'weighted_average') {
    if (!confidences || confidences.length === 0) {
      return { finalConfidence: 0.0, confidenceLevel: 'very_low' };
    }

    let aggregatedScore;

    switch (method) {
      case 'min':
        // Conservative: use minimum confidence
        aggregatedScore = Math.min(...confidences);
        break;

      case 'max':
        // Optimistic: use maximum confidence
        aggregatedScore = Math.max(...confidences);
        break;

      case 'median':
        // Middle ground
        const sorted = [...confidences].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        aggregatedScore = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        break;

      case 'weighted_average':
      default:
        // Weighted by position (higher confidence items weighted more)
        const sorted2 = [...confidences].sort((a, b) => b - a);
        const weights = sorted2.map((_, idx) => 1 / (idx + 1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        aggregatedScore = sorted2.reduce((sum, conf, idx) => 
          sum + (conf * weights[idx] / totalWeight), 0
        );
        break;
    }

    return {
      finalConfidence: this._normalizeScore(aggregatedScore),
      confidenceLevel: this._getConfidenceLevel(aggregatedScore),
      method,
      itemCount: confidences.length,
      range: {
        min: Math.min(...confidences),
        max: Math.max(...confidences),
        spread: Math.max(...confidences) - Math.min(...confidences)
      }
    };
  }

  /**
   * Update weights dynamically (for tuning)
   */
  setWeights(newWeights) {
    const totalWeight = Object.values(newWeights).reduce((a, b) => a + b, 0);
    
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error('Weights must sum to 1.0');
    }

    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      weights: this.weights,
      thresholds: this.thresholds
    };
  }
}

// Singleton instance
const confidenceCalculator = new ConfidenceCalculator();

module.exports = confidenceCalculator;
