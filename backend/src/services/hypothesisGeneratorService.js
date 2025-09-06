const geminiService = require('./geminiService');
const debug = require('debug')('researchai:hypothesis');

class HypothesisGeneratorService {
  constructor() {
    this.confidenceThreshold = 0.7;
  }

  /**
   * Generate novel, testable hypotheses based on research gaps
   */
  async generateHypotheses(papers, researchArea, gapAnalysis) {
    debug('Generating hypotheses for %d papers in area: %s', papers.length, researchArea);

    try {
      // Extract contradictions and unexplored intersections
      const contradictions = await this.findContradictions(papers);
      const intersections = await this.findUnexploredIntersections(papers, researchArea);
      const methodologicalGaps = await this.identifyMethodologicalGaps(papers);

      // Generate different types of hypotheses
      const hypotheses = await Promise.all([
        this.generateContradictionHypotheses(contradictions, researchArea),
        this.generateIntersectionHypotheses(intersections, researchArea), 
        this.generateMethodologicalHypotheses(methodologicalGaps, researchArea),
        this.generateExtensionHypotheses(papers, researchArea)
      ]);

      // Flatten and rank hypotheses
      const allHypotheses = hypotheses.flat();
      const rankedHypotheses = await this.rankHypotheses(allHypotheses, papers);

      return {
        researchArea,
        totalPapers: papers.length,
        hypotheses: rankedHypotheses.slice(0, 10), // Top 10
        metadata: {
          contradictions: contradictions.length,
          intersections: intersections.length,
          methodologicalGaps: methodologicalGaps.length,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      debug('Error generating hypotheses: %O', error);
      throw error;
    }
  }

  /**
   * Find contradictory findings across papers
   */
  async findContradictions(papers) {
    const prompt = `Analyze the following research papers and identify contradictory findings, conflicting results, or opposing conclusions.

PAPERS ANALYSIS:
${papers.map((p, i) => `
Paper ${i + 1}: "${p.title}"
Authors: ${p.authors}
Key Findings: ${p.abstract}
${p.content ? `Additional Context: ${p.content.substring(0, 1000)}...` : ''}
`).join('\n')}

INSTRUCTIONS:
1. Identify specific contradictions between papers
2. Note conflicting methodologies that lead to different results
3. Highlight opposing theoretical frameworks
4. Focus on substantive disagreements, not minor variations

Return a JSON array of contradictions with this structure:
[{
  "contradiction": "Brief description",
  "papers": ["Paper 1 title", "Paper 2 title"],
  "details": "Detailed explanation of the conflict",
  "significance": "Why this contradiction matters"
}]`;

    try {
      const response = await geminiService.generateText(prompt);
      const contradictions = JSON.parse(response);
      return Array.isArray(contradictions) ? contradictions : [];
    } catch (error) {
      debug('Error finding contradictions: %O', error);
      return [];
    }
  }

  /**
   * Find unexplored intersections between research areas
   */
  async findUnexploredIntersections(papers, researchArea) {
    const prompt = `Identify unexplored intersections and cross-disciplinary opportunities based on these papers in ${researchArea}.

RESEARCH PAPERS:
${papers.map((p, i) => `
Paper ${i + 1}: "${p.title}"
Research Domain: ${this.extractDomain(p)}
Methods: ${this.extractMethods(p)}
Applications: ${this.extractApplications(p)}
`).join('\n')}

TASK:
Find combinations of:
1. Methods from one paper + Applications from another
2. Theoretical frameworks that haven't been combined
3. Cross-domain applications not yet explored
4. Methodological innovations waiting to be applied

Return JSON array:
[{
  "intersection": "Brief description",
  "domains": ["Domain 1", "Domain 2"],
  "potential": "What could be discovered",
  "feasibility": "High/Medium/Low",
  "novelty": "Why this hasn't been done"
}]`;

    try {
      const response = await geminiService.generateText(prompt);
      const intersections = JSON.parse(response);
      return Array.isArray(intersections) ? intersections : [];
    } catch (error) {
      debug('Error finding intersections: %O', error);
      return [];
    }
  }

  /**
   * Generate hypotheses based on contradictions
   */
  async generateContradictionHypotheses(contradictions, researchArea) {
    if (contradictions.length === 0) return [];

    const prompt = `Generate testable research hypotheses that could resolve these contradictions in ${researchArea}:

CONTRADICTIONS:
${contradictions.map((c, i) => `
${i + 1}. ${c.contradiction}
   Papers: ${c.papers.join(' vs ')}
   Details: ${c.details}
`).join('\n')}

GENERATE HYPOTHESES that:
1. Propose explanations for why contradictions exist
2. Suggest conditions under which each side might be correct
3. Identify mediating or moderating variables
4. Propose unified theoretical frameworks

Format as JSON array:
[{
  "hypothesis": "Clear, testable hypothesis statement",
  "rationale": "Why this explains the contradiction",
  "testMethod": "How to test this hypothesis",
  "expectedOutcome": "What results would support/refute",
  "significance": "Impact if proven true",
  "confidence": 0.8,
  "type": "contradiction-resolution"
}]`;

    try {
      const response = await geminiService.generateText(prompt);
      const hypotheses = JSON.parse(response);
      return Array.isArray(hypotheses) ? hypotheses : [];
    } catch (error) {
      debug('Error generating contradiction hypotheses: %O', error);
      return [];
    }
  }

  /**
   * Generate hypotheses from unexplored intersections
   */
  async generateIntersectionHypotheses(intersections, researchArea) {
    if (intersections.length === 0) return [];

    const prompt = `Create novel research hypotheses by combining unexplored intersections in ${researchArea}:

UNEXPLORED INTERSECTIONS:
${intersections.map((int, i) => `
${i + 1}. ${int.intersection}
   Domains: ${int.domains.join(' + ')}
   Potential: ${int.potential}
   Feasibility: ${int.feasibility}
`).join('\n')}

GENERATE HYPOTHESES that:
1. Combine methods/theories from different domains
2. Apply established techniques to new problems
3. Bridge theoretical gaps between fields
4. Propose novel applications or extensions

JSON Format:
[{
  "hypothesis": "Specific, testable prediction",
  "combination": "What domains/methods are being combined",
  "novelty": "Why this combination is innovative",
  "testMethod": "Experimental or analytical approach",
  "barriers": "Potential challenges",
  "confidence": 0.7,
  "type": "intersection-exploration"
}]`;

    try {
      const response = await geminiService.generateText(prompt);
      const hypotheses = JSON.parse(response);
      return Array.isArray(hypotheses) ? hypotheses : [];
    } catch (error) {
      debug('Error generating intersection hypotheses: %O', error);
      return [];
    }
  }

  /**
   * Identify methodological gaps
   */
  async identifyMethodologicalGaps(papers) {
    const prompt = `Analyze methodological approaches across these papers and identify gaps:

METHODOLOGICAL ANALYSIS:
${papers.map((p, i) => `
Paper ${i + 1}: "${p.title}"
Methods Used: ${this.extractMethods(p)}
Evaluation: ${this.extractEvaluation(p)}
Limitations: ${this.extractLimitations(p)}
`).join('\n')}

IDENTIFY:
1. Missing evaluation metrics or benchmarks
2. Unexplored experimental designs
3. Underutilized analytical techniques
4. Gaps in data collection or validation

Return JSON array of methodological gaps.`;

    try {
      const response = await geminiService.generateText(prompt);
      const gaps = JSON.parse(response);
      return Array.isArray(gaps) ? gaps : [];
    } catch (error) {
      debug('Error identifying methodological gaps: %O', error);
      return [];
    }
  }

  /**
   * Generate extension hypotheses
   */
  async generateExtensionHypotheses(papers, researchArea) {
    const prompt = `Generate hypotheses that extend or build upon existing work in ${researchArea}:

EXISTING RESEARCH:
${papers.map((p, i) => `
Paper ${i + 1}: "${p.title}"
Key Innovation: ${this.extractInnovation(p)}
Scope/Limitations: ${this.extractScope(p)}
Future Work Mentioned: ${this.extractFutureWork(p)}
`).join('\n')}

CREATE HYPOTHESES that:
1. Scale existing methods to new domains
2. Combine successful approaches
3. Address stated limitations
4. Extend temporal or spatial scope

JSON Format with confidence scores and test methods.`;

    try {
      const response = await geminiService.generateText(prompt);
      const hypotheses = JSON.parse(response);
      return Array.isArray(hypotheses) ? hypotheses : [];
    } catch (error) {
      debug('Error generating extension hypotheses: %O', error);
      return [];
    }
  }

  /**
   * Rank hypotheses by novelty, feasibility, and impact
   */
  async rankHypotheses(hypotheses, papers) {
    // Score each hypothesis on multiple dimensions
    const scoredHypotheses = hypotheses.map(h => ({
      ...h,
      scores: {
        novelty: this.calculateNoveltyScore(h, papers),
        feasibility: this.calculateFeasibilityScore(h),
        impact: this.calculateImpactScore(h),
        testability: this.calculateTestabilityScore(h)
      }
    }));

    // Calculate composite score
    scoredHypotheses.forEach(h => {
      h.compositeScore = (
        h.scores.novelty * 0.3 +
        h.scores.feasibility * 0.25 +
        h.scores.impact * 0.3 +
        h.scores.testability * 0.15
      );
    });

    // Sort by composite score
    return scoredHypotheses.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  // Helper methods for extraction and scoring
  extractDomain(paper) {
    // Extract research domain from title/abstract
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    const domains = ['machine learning', 'ai', 'nlp', 'computer vision', 'robotics', 'healthcare', 'biology'];
    return domains.find(d => text.includes(d)) || 'general';
  }

  extractMethods(paper) {
    const methodKeywords = ['neural network', 'deep learning', 'regression', 'classification', 'clustering', 'reinforcement learning'];
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    return methodKeywords.filter(m => text.includes(m)).join(', ') || 'not specified';
  }

  calculateNoveltyScore(hypothesis) {
    // Score based on uniqueness of combination and approach
    const noveltyIndicators = ['novel', 'first', 'unprecedented', 'innovative', 'unexplored'];
    const text = hypothesis.hypothesis.toLowerCase();
    const matches = noveltyIndicators.filter(n => text.includes(n)).length;
    return Math.min(matches * 0.2 + 0.5, 1.0);
  }

  calculateFeasibilityScore(hypothesis) {
    // Score based on described test method and barriers
    if (!hypothesis.testMethod) return 0.3;
    if (hypothesis.barriers && hypothesis.barriers.includes('high cost')) return 0.4;
    if (hypothesis.testMethod.includes('simulation') || hypothesis.testMethod.includes('analysis')) return 0.8;
    return 0.6;
  }

  calculateImpactScore(hypothesis) {
    // Score based on significance and potential applications
    if (!hypothesis.significance) return 0.5;
    const impactWords = ['breakthrough', 'significant', 'transformative', 'paradigm', 'revolutionary'];
    const text = hypothesis.significance.toLowerCase();
    const matches = impactWords.filter(w => text.includes(w)).length;
    return Math.min(matches * 0.15 + 0.4, 1.0);
  }

  calculateTestabilityScore(hypothesis) {
    // Score based on how clearly testable the hypothesis is
    if (!hypothesis.testMethod || !hypothesis.expectedOutcome) return 0.3;
    if (hypothesis.testMethod.includes('experiment') && hypothesis.expectedOutcome.includes('measure')) return 0.9;
    return 0.6;
  }
}

module.exports = new HypothesisGeneratorService();