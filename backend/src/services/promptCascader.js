/**
 * Prompt Cascader Service
 * 
 * Dynamically builds prompts using templates and agent metadata.
 * Supports:
 * - Template loading from /prompts/ folder
 * - Domain parameter injection
 * - Context summarization
 * - Variable substitution
 */

const fs = require('fs').promises;
const path = require('path');

class PromptCascader {
  constructor() {
    this.promptsDir = path.join(__dirname, '../../prompts');
    this.templateCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize and load all templates
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Create prompts directory if it doesn't exist
      await fs.mkdir(this.promptsDir, { recursive: true });

      // Load all template files
      const files = await fs.readdir(this.promptsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const templateName = file.replace('.md', '');
        const content = await fs.readFile(
          path.join(this.promptsDir, file),
          'utf-8'
        );
        this.templateCache.set(templateName, content);
      }

      this.initialized = true;
      console.log(`Loaded ${this.templateCache.size} prompt templates`);
    } catch (error) {
      console.error('Error initializing prompt templates:', error.message);
      // Continue without templates (use defaults)
    }
  }

  /**
   * Build prompt for Micro Agent (paper analysis)
   */
  async buildMicroPrompt(options = {}) {
    await this.initialize();

    const {
      paper = {},
      domain = 'general',
      focusAreas = [],
      contextSummary = null
    } = options;

    const template = this.templateCache.get('micro_prompt_template') || this._getDefaultMicroTemplate();

    const variables = {
      DOMAIN: domain,
      PAPER_TITLE: paper.title || 'Unknown',
      PAPER_ABSTRACT: paper.abstract || 'No abstract available',
      PAPER_YEAR: paper.year || 'Unknown',
      PAPER_AUTHORS: Array.isArray(paper.authors) ? paper.authors.join(', ') : 'Unknown',
      PAPER_CONTENT: this._truncateContent(paper.fullText || paper.content || '', 8000),
      FOCUS_AREAS: focusAreas.length > 0 
        ? focusAreas.map(f => `- ${f}`).join('\n')
        : '- Key contributions\n- Methodological approach\n- Research gaps',
      CONTEXT_SUMMARY: contextSummary || 'No prior context available. This is the first analysis.',
      EXTRACTION_DEPTH: options.depth || 'detailed'
    };

    return this._interpolateTemplate(template, variables);
  }

  /**
   * Build prompt for Meso Agent (clustering)
   */
  async buildMesoPrompt(options = {}) {
    await this.initialize();

    const {
      microOutputs = [],
      domain = 'general',
      clusteringStrategy = 'thematic',
      contextSummary = null
    } = options;

    const template = this.templateCache.get('meso_prompt_template') || this._getDefaultMesoTemplate();

    // Summarize micro outputs
    const paperSummaries = microOutputs.map((output, idx) => {
      return `
Paper ${idx + 1}: ${output.title || 'Unknown'}
- Contributions: ${output.contributions?.length || 0} identified
- Research Gaps: ${output.researchGaps?.length || 0} found
- Confidence: ${(output.confidence * 100).toFixed(1)}%
      `.trim();
    }).join('\n\n');

    const variables = {
      DOMAIN: domain,
      TOTAL_PAPERS: microOutputs.length,
      PAPER_SUMMARIES: paperSummaries,
      CLUSTERING_STRATEGY: clusteringStrategy,
      CONTEXT_SUMMARY: contextSummary || 'No prior clustering context.',
      MIN_CLUSTER_SIZE: options.minClusterSize || 2,
      MAX_CLUSTERS: options.maxClusters || Math.ceil(microOutputs.length / 3)
    };

    return this._interpolateTemplate(template, variables);
  }

  /**
   * Build prompt for Meta Agent (synthesis)
   */
  async buildMetaPrompt(options = {}) {
    await this.initialize();

    const {
      mesoOutput = {},
      domain = 'general',
      iteration = 1,
      previousMetaOutput = null,
      contextSummary = null
    } = options;

    const template = this.templateCache.get('meta_prompt_template') || this._getDefaultMetaTemplate();

    // Summarize meso clustering
    const clusterSummaries = (mesoOutput.clusters || []).map((cluster, idx) => {
      return `
Cluster ${idx + 1}: ${cluster.theme?.label || 'Unknown Theme'}
- Papers: ${cluster.papers?.length || 0}
- Key Contributions: ${cluster.keyContributions?.length || 0}
- Identified Gaps: ${cluster.identifiedGaps?.length || 0}
- Cohesion: ${((cluster.cohesion || 0) * 100).toFixed(1)}%
      `.trim();
    }).join('\n\n');

    // Previous iteration context
    let previousContext = 'This is the first iteration.';
    if (previousMetaOutput) {
      const prevGaps = previousMetaOutput.rankedGaps || [];
      previousContext = `
Previous iteration identified ${prevGaps.length} research gaps.
Top 3 gaps from previous iteration:
${prevGaps.slice(0, 3).map((g, i) => `${i + 1}. ${g.gap} (Score: ${g.totalScore?.toFixed(2)})`).join('\n')}

Focus on refining these gaps and identifying new cross-domain opportunities.
      `.trim();
    }

    const variables = {
      DOMAIN: domain,
      ITERATION: iteration,
      TOTAL_CLUSTERS: (mesoOutput.clusters || []).length,
      CLUSTER_SUMMARIES: clusterSummaries,
      TOTAL_PATTERNS: (mesoOutput.patterns || []).length,
      PREVIOUS_ITERATION_CONTEXT: previousContext,
      CONTEXT_SUMMARY: contextSummary || 'No prior meta-level context.',
      CONVERGENCE_THRESHOLD: options.convergenceThreshold || 0.7,
      MAX_GAPS_TO_RANK: options.maxGapsToRank || 20
    };

    return this._interpolateTemplate(template, variables);
  }

  /**
   * Build custom prompt with variable substitution
   */
  buildCustomPrompt(templateName, variables = {}) {
    const template = this.templateCache.get(templateName);
    
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this._interpolateTemplate(template, variables);
  }

  /**
   * Interpolate template with variables
   * Supports {{VARIABLE}} syntax
   */
  _interpolateTemplate(template, variables) {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    // Remove any unmatched placeholders
    result = result.replace(/{{[A-Z_]+}}/g, '[NOT PROVIDED]');

    return result;
  }

  /**
   * Truncate content to max length
   */
  _truncateContent(content, maxLength) {
    if (content.length <= maxLength) return content;

    return content.substring(0, maxLength) + '\n\n[... Content truncated for length ...]';
  }

  /**
   * Summarize context for inclusion in prompts
   */
  summarizeContext(context, maxLength = 500) {
    if (!context) return 'No context available.';

    const contextStr = typeof context === 'string' 
      ? context 
      : JSON.stringify(context, null, 2);

    if (contextStr.length <= maxLength) return contextStr;

    // Extract key points
    const lines = contextStr.split('\n');
    const importantLines = lines.filter(line => 
      line.includes('gap') || 
      line.includes('contribution') || 
      line.includes('finding') ||
      line.includes('confidence')
    );

    const summary = importantLines.slice(0, 10).join('\n');
    
    return summary.length > 0 
      ? summary + '\n[... Additional context omitted ...]'
      : this._truncateContent(contextStr, maxLength);
  }

  /**
   * Reload templates from disk
   */
  async reloadTemplates() {
    this.templateCache.clear();
    this.initialized = false;
    await this.initialize();
  }

  // Default templates (fallback if files don't exist)

  _getDefaultMicroTemplate() {
    return `# Micro Agent Analysis Task

## Domain: {{DOMAIN}}

## Paper Information
- **Title:** {{PAPER_TITLE}}
- **Authors:** {{PAPER_AUTHORS}}
- **Year:** {{PAPER_YEAR}}

## Abstract
{{PAPER_ABSTRACT}}

## Full Paper Content
{{PAPER_CONTENT}}

## Analysis Instructions

Analyze this research paper with {{EXTRACTION_DEPTH}} depth and extract:

### 1. Key Contributions
Identify the main contributions of this paper. For each contribution:
- Type (methodological, theoretical, empirical, tool/system)
- Clear description
- Confidence score (0-1)

### 2. Limitations
Extract both stated and inferred limitations:
- Type (methodological, theoretical, practical, scope)
- Description
- Severity (low, medium, high)

### 3. Research Gaps
Identify research gaps and future work opportunities:
- Type (methodological, empirical, theoretical, application)
- Description
- Priority (low, medium, high)

### 4. Methodology Assessment
- Approach used
- Techniques employed
- Datasets utilized
- Reproducibility concerns

## Focus Areas
{{FOCUS_AREAS}}

## Prior Context
{{CONTEXT_SUMMARY}}

## Output Format
Provide a structured JSON response with the following schema:
{
  "contributions": [...],
  "limitations": [...],
  "researchGaps": [...],
  "methodology": {...},
  "confidence": 0.0-1.0
}
`;
  }

  _getDefaultMesoTemplate() {
    return `# Meso Agent Clustering Task

## Domain: {{DOMAIN}}

## Overview
You are analyzing {{TOTAL_PAPERS}} research papers that have been individually processed.

## Paper Summaries
{{PAPER_SUMMARIES}}

## Clustering Strategy: {{CLUSTERING_STRATEGY}}

## Instructions

Perform thematic clustering and pattern analysis:

### 1. Cluster Formation
- Create {{MIN_CLUSTER_SIZE}} to {{MAX_CLUSTERS}} meaningful clusters
- Group papers by thematic similarity
- Assign clear theme labels and keywords to each cluster

### 2. Cluster Analysis
For each cluster, identify:
- Common methodologies
- Key collective contributions
- Shared research gaps
- Trends (increasing activity, high impact areas)

### 3. Cross-Cluster Patterns
Identify patterns that span multiple clusters:
- Methodological overlaps
- Complementary findings
- Contradictory results

### 4. Thematic Gaps
Synthesize research gaps at the thematic level:
- Gaps that appear across multiple papers
- Systemic methodological limitations
- Unexplored research directions

## Prior Context
{{CONTEXT_SUMMARY}}

## Output Format
{
  "clusters": [...],
  "patterns": [...],
  "thematicGaps": [...]
}
`;
  }

  _getDefaultMetaTemplate() {
    return `# Meta Agent Synthesis Task

## Domain: {{DOMAIN}}
## Iteration: {{ITERATION}}

## Cluster Analysis Summary
Total Clusters: {{TOTAL_CLUSTERS}}
Total Cross-Cluster Patterns: {{TOTAL_PATTERNS}}

{{CLUSTER_SUMMARIES}}

## Previous Iteration Context
{{PREVIOUS_ITERATION_CONTEXT}}

## Instructions

Perform cross-domain synthesis and gap ranking:

### 1. Cross-Domain Pattern Recognition
Identify high-level patterns across all clusters:
- Methodological trends
- Theoretical convergences
- Application domains with synergies

### 2. Research Gap Ranking
Rank up to {{MAX_GAPS_TO_RANK}} research gaps using these criteria:
- **Importance** (0.35 weight): Impact on field
- **Novelty** (0.25 weight): Uniqueness of opportunity
- **Feasibility** (0.20 weight): Practical achievability
- **Impact** (0.20 weight): Potential for breakthrough

### 3. Research Frontiers
Identify emerging research frontiers:
- Trending topics with increasing activity
- Cross-domain opportunities
- Methodological innovations

### 4. Actionable Directions
Generate concrete research recommendations:
- Specific problem statements
- Suggested approaches
- Expected outcomes

### 5. Convergence Check
Compare with previous iteration (if available):
- Calculate similarity of top 10 ranked gaps
- Determine if convergence threshold ({{CONVERGENCE_THRESHOLD}}) is met

## Prior Context
{{CONTEXT_SUMMARY}}

## Output Format
{
  "rankedGaps": [...],
  "crossDomainPatterns": [...],
  "researchFrontiers": [...],
  "recommendedDirections": [...],
  "convergence": {
    "converged": boolean,
    "similarity": 0.0-1.0,
    "reason": "..."
  }
}
`;
  }
}

// Singleton instance
const promptCascader = new PromptCascader();

module.exports = promptCascader;
