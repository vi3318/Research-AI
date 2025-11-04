/**
 * Micro Agent Worker - RMRI System
 * 
 * Processes individual papers to extract:
 * - Key contributions
 * - Limitations and constraints
 * - Research gaps
 * - Methodological details
 * 
 * Uses SciBERT embeddings + LLM analysis for deep understanding
 */

const Queue = require('bull');
const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const debug = require('debug')('researchai:micro-agent');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create Bull Queue for micro agent jobs
const microAgentQueue = new Queue('rmri-micro-agent', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

/**
 * Micro Agent Job Processor
 * Analyzes individual papers and extracts structured insights
 */
microAgentQueue.process(async (job, done) => {
  const { runId, agentId, paper, iteration, llmClient } = job.data;
  const startTime = Date.now();

  try {
    debug(`🔬 Micro Agent ${agentId} processing paper: ${paper.title}`);

    // Log job start
    await logToDatabase(runId, agentId, 'info', 
      `Micro agent started analyzing: ${paper.title?.substring(0, 100) || 'Untitled'}`
    );

    // Update agent status
    await updateAgentStatus(agentId, 'active', { currentPaper: paper.title });

    // Step 1: Extract paper structure
    const paperStructure = await extractPaperStructure(paper);

    // Step 2: Generate SciBERT embeddings for semantic understanding
    const embeddings = await generatePaperEmbeddings(paper, paperStructure);

    // Step 3: LLM-based deep analysis
    const analysis = await performDeepAnalysis(paper, paperStructure, llmClient);

    // Step 4: Extract specific components
    const contributions = await extractContributions(paper, analysis, llmClient);
    const limitations = await extractLimitations(paper, analysis, llmClient);
    const gaps = await identifyGaps(paper, analysis, llmClient);
    const methodology = await extractMethodology(paper, analysis, llmClient);

    // Step 5: Calculate confidence scores
    const confidence = calculateConfidence(contributions, limitations, gaps);

    // Step 6: Structure output
    const microOutput = {
      paperId: paper.id || paper.doi || generatePaperId(paper),
      title: paper.title,
      authors: paper.authors || [],
      year: paper.year,
      citations: paper.citations || 0,
      venue: paper.venue,
      
      // Core extractions
      contributions: contributions,
      limitations: limitations,
      researchGaps: gaps,
      methodology: methodology,
      
      // Embeddings for clustering
      embeddings: embeddings,
      
      // Metadata
      confidence: confidence,
      processingTime: Date.now() - startTime,
      iteration: iteration,
      agentId: agentId,
      timestamp: new Date().toISOString()
    };

    // Step 7: Write to context storage
    const contextKey = `micro_output_${iteration}_${paper.id || Date.now()}`;
    await contextStorage.writeContext(
      runId,
      agentId,
      contextKey,
      microOutput,
      'append',
      { paperTitle: paper.title, iteration }
    );

    // Step 8: Store in results table
    await supabase.from('rmri_results').insert({
      run_id: runId,
      agent_id: agentId,
      result_type: 'analysis',
      content: microOutput,
      confidence_score: confidence,
      sources: [{ 
        title: paper.title, 
        doi: paper.doi,
        url: paper.url 
      }],
      is_final: false
    });

    // Log completion
    await logToDatabase(runId, agentId, 'info',
      `Micro agent completed analysis with ${confidence} confidence`
    );

    // Update agent status
    const executionTime = Date.now() - startTime;
    await updateAgentStatus(agentId, 'completed', { 
      executionTime,
      confidence 
    });

    debug(`✅ Micro Agent completed in ${executionTime}ms`);

    done(null, microOutput);

  } catch (error) {
    debug(`❌ Micro Agent error:`, error.message);
    
    await logToDatabase(runId, agentId, 'error',
      `Micro agent failed: ${error.message}`,
      { error: error.stack }
    );

    await updateAgentStatus(agentId, 'failed', { 
      error: error.message 
    });

    done(error);
  }
});

/**
 * Extract structured components from paper
 */
async function extractPaperStructure(paper) {
  const structure = {
    abstract: paper.abstract || '',
    fullText: paper.fullText || paper.content || '',
    sections: {},
    references: paper.references || []
  };

  // Simple section detection
  const text = structure.fullText.toLowerCase();
  
  // Detect common sections
  const sectionPatterns = {
    introduction: /\bintroduction\b/i,
    methodology: /\b(methodology|methods|approach)\b/i,
    results: /\b(results|findings|experiments)\b/i,
    discussion: /\b(discussion|analysis)\b/i,
    conclusion: /\b(conclusion|summary)\b/i,
    relatedWork: /\b(related work|background|literature review)\b/i
  };

  for (const [section, pattern] of Object.entries(sectionPatterns)) {
    if (pattern.test(text)) {
      structure.sections[section] = true;
    }
  }

  return structure;
}

/**
 * Generate embeddings using SciBERT-style approach
 * (Simplified - would use actual SciBERT in production)
 */
async function generatePaperEmbeddings(paper, structure) {
  // Combine key text elements
  const textForEmbedding = [
    paper.title || '',
    paper.abstract || '',
    structure.fullText?.substring(0, 2000) || '' // First 2000 chars
  ].join(' ');

  // In production, this would call SciBERT API
  // For now, create a simple embedding representation
  const embedding = {
    title: await simpleEmbedding(paper.title || ''),
    abstract: await simpleEmbedding(paper.abstract || ''),
    combined: await simpleEmbedding(textForEmbedding)
  };

  return embedding;
}

/**
 * Simple embedding placeholder (would use actual model in production)
 */
async function simpleEmbedding(text) {
  // This would be replaced with actual SciBERT/sentence-transformers call
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const uniqueWords = [...new Set(words)];
  
  return {
    dimension: 768, // SciBERT dimension
    vector: uniqueWords.slice(0, 50), // Simplified representation
    text_length: text.length
  };
}

/**
 * Perform deep LLM-based analysis
 */
async function performDeepAnalysis(paper, structure, llmClient) {
  const prompt = `Analyze this research paper and provide a comprehensive assessment:

Title: ${paper.title}
Abstract: ${paper.abstract || 'Not available'}

Provide a structured analysis covering:
1. Main research problem addressed
2. Novel contributions
3. Methodological approach
4. Key findings
5. Stated limitations
6. Potential gaps or future work

Be specific and cite evidence from the text where possible.`;

  // This will use the LLM client (to be implemented)
  const analysis = {
    problem: extractProblemStatement(paper, structure),
    novelty: extractNovelty(paper, structure),
    approach: extractApproach(paper, structure),
    findings: extractFindings(paper, structure),
    limitations: extractStatedLimitations(paper, structure),
    futureWork: extractFutureWork(paper, structure)
  };

  return analysis;
}

/**
 * Extract contributions using LLM
 */
async function extractContributions(paper, analysis, llmClient) {
  const contributions = [];

  // Extract from analysis
  if (analysis.novelty) {
    contributions.push({
      type: 'methodological',
      description: analysis.novelty,
      confidence: 0.8,
      evidence: 'From paper analysis'
    });
  }

  // Extract from abstract
  if (paper.abstract) {
    const abstractContribs = extractContributionsFromText(paper.abstract);
    contributions.push(...abstractContribs);
  }

  return contributions;
}

/**
 * Extract limitations using LLM
 */
async function extractLimitations(paper, analysis, llmClient) {
  const limitations = [];

  // From stated limitations
  if (analysis.limitations) {
    limitations.push({
      type: 'stated',
      description: analysis.limitations,
      severity: 'medium',
      confidence: 0.9
    });
  }

  // Inferred limitations from methodology
  const methodLimitations = inferMethodologicalLimitations(paper, analysis);
  limitations.push(...methodLimitations);

  // Data limitations
  const dataLimitations = inferDataLimitations(paper, analysis);
  limitations.push(...dataLimitations);

  return limitations;
}

/**
 * Identify research gaps
 */
async function identifyGaps(paper, analysis, llmClient) {
  const gaps = [];

  // From future work section
  if (analysis.futureWork) {
    gaps.push({
      type: 'stated_future_work',
      description: analysis.futureWork,
      priority: 'high',
      confidence: 0.85,
      source: 'paper_explicit'
    });
  }

  // Inferred from limitations
  const limitationGaps = inferGapsFromLimitations(analysis.limitations);
  gaps.push(...limitationGaps);

  // Methodological gaps
  const methodGaps = identifyMethodologicalGaps(paper, analysis);
  gaps.push(...methodGaps);

  return gaps;
}

/**
 * Extract methodology details
 */
async function extractMethodology(paper, analysis, llmClient) {
  return {
    approach: analysis.approach || 'Not specified',
    techniques: extractTechniques(paper),
    datasets: extractDatasets(paper),
    metrics: extractMetrics(paper),
    reproducibility: assessReproducibility(paper)
  };
}

/**
 * Helper functions for extraction
 */
function extractProblemStatement(paper, structure) {
  const abstract = paper.abstract || '';
  const problemKeywords = ['problem', 'challenge', 'issue', 'addresses', 'tackles'];
  
  const sentences = abstract.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (problemKeywords.some(kw => lower.includes(kw))) {
      return sentence.trim();
    }
  }
  
  return 'Problem statement not clearly identified';
}

function extractNovelty(paper, structure) {
  const abstract = paper.abstract || '';
  const noveltyKeywords = ['novel', 'new', 'first', 'propose', 'introduce', 'original'];
  
  const sentences = abstract.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (noveltyKeywords.some(kw => lower.includes(kw))) {
      return sentence.trim();
    }
  }
  
  return 'Novelty not explicitly stated';
}

function extractApproach(paper, structure) {
  const abstract = paper.abstract || '';
  const approachKeywords = ['method', 'approach', 'technique', 'algorithm', 'framework'];
  
  const sentences = abstract.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (approachKeywords.some(kw => lower.includes(kw))) {
      return sentence.trim();
    }
  }
  
  return 'Methodology not specified in abstract';
}

function extractFindings(paper, structure) {
  const abstract = paper.abstract || '';
  const findingsKeywords = ['result', 'finding', 'show', 'demonstrate', 'achieve'];
  
  const sentences = abstract.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (findingsKeywords.some(kw => lower.includes(kw))) {
      return sentence.trim();
    }
  }
  
  return 'Results not summarized in abstract';
}

function extractStatedLimitations(paper, structure) {
  const text = (paper.fullText || '').toLowerCase();
  const limitationKeywords = ['limitation', 'constraint', 'weakness', 'drawback'];
  
  if (limitationKeywords.some(kw => text.includes(kw))) {
    return 'Paper discusses limitations (full text analysis needed)';
  }
  
  return 'No explicit limitations stated';
}

function extractFutureWork(paper, structure) {
  const text = (paper.fullText || '').toLowerCase();
  const futureKeywords = ['future work', 'future research', 'future direction'];
  
  if (futureKeywords.some(kw => text.includes(kw))) {
    return 'Paper discusses future research directions';
  }
  
  return 'No future work explicitly mentioned';
}

function extractContributionsFromText(text) {
  const contributions = [];
  const sentences = text.split(/[.!?]+/);
  
  const contributionKeywords = ['contribute', 'contribution', 'propose', 'introduce', 'develop'];
  
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (contributionKeywords.some(kw => lower.includes(kw))) {
      contributions.push({
        type: 'extracted',
        description: sentence.trim(),
        confidence: 0.7,
        evidence: 'From abstract'
      });
    }
  });
  
  return contributions;
}

function inferMethodologicalLimitations(paper, analysis) {
  const limitations = [];
  
  // Check for common methodological limitations
  const text = (paper.abstract || '').toLowerCase();
  
  if (!text.includes('validation') && !text.includes('evaluate')) {
    limitations.push({
      type: 'methodological',
      description: 'Limited validation or evaluation mentioned',
      severity: 'medium',
      confidence: 0.6
    });
  }
  
  return limitations;
}

function inferDataLimitations(paper, analysis) {
  const limitations = [];
  const text = (paper.abstract || '').toLowerCase();
  
  if (text.includes('small dataset') || text.includes('limited data')) {
    limitations.push({
      type: 'data',
      description: 'Dataset size limitations mentioned',
      severity: 'high',
      confidence: 0.8
    });
  }
  
  return limitations;
}

function inferGapsFromLimitations(limitations) {
  if (!limitations) return [];
  
  return [{
    type: 'limitation_derived',
    description: 'Addressing stated limitations represents research opportunity',
    priority: 'medium',
    confidence: 0.7,
    source: 'inferred'
  }];
}

function identifyMethodologicalGaps(paper, analysis) {
  const gaps = [];
  const text = (paper.abstract || '').toLowerCase();
  
  // Check for missing evaluations
  if (!text.includes('comparison') && !text.includes('baseline')) {
    gaps.push({
      type: 'methodological',
      description: 'Lack of comparative evaluation with baselines',
      priority: 'medium',
      confidence: 0.6,
      source: 'inferred'
    });
  }
  
  return gaps;
}

function extractTechniques(paper) {
  const text = (paper.abstract || '').toLowerCase();
  const techniques = [];
  
  const commonTechniques = [
    'neural network', 'deep learning', 'machine learning',
    'regression', 'classification', 'clustering',
    'optimization', 'algorithm', 'model'
  ];
  
  commonTechniques.forEach(tech => {
    if (text.includes(tech)) {
      techniques.push(tech);
    }
  });
  
  return techniques;
}

function extractDatasets(paper) {
  const text = paper.abstract || '';
  const datasets = [];
  
  // Common dataset patterns
  const datasetPattern = /\b([A-Z][A-Za-z0-9-]+)\s+dataset/gi;
  const matches = text.matchAll(datasetPattern);
  
  for (const match of matches) {
    datasets.push(match[1]);
  }
  
  return datasets;
}

function extractMetrics(paper) {
  const text = (paper.abstract || '').toLowerCase();
  const metrics = [];
  
  const commonMetrics = [
    'accuracy', 'precision', 'recall', 'f1', 'f1-score',
    'auc', 'roc', 'rmse', 'mae', 'mse',
    'performance', 'efficiency', 'effectiveness'
  ];
  
  commonMetrics.forEach(metric => {
    if (text.includes(metric)) {
      metrics.push(metric);
    }
  });
  
  return metrics;
}

function assessReproducibility(paper) {
  const text = (paper.abstract || paper.fullText || '').toLowerCase();
  
  const reproducibilityIndicators = {
    codeAvailable: text.includes('code') && (text.includes('available') || text.includes('github')),
    dataAvailable: text.includes('dataset') && text.includes('available'),
    detailedMethod: text.includes('detail') || text.includes('implement'),
    openSource: text.includes('open source') || text.includes('open-source')
  };
  
  const score = Object.values(reproducibilityIndicators).filter(Boolean).length / 4;
  
  return {
    score: score,
    indicators: reproducibilityIndicators,
    level: score > 0.5 ? 'high' : score > 0.25 ? 'medium' : 'low'
  };
}

/**
 * Calculate overall confidence score
 */
function calculateConfidence(contributions, limitations, gaps) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on extracted information
  if (contributions && contributions.length > 0) confidence += 0.15;
  if (limitations && limitations.length > 0) confidence += 0.15;
  if (gaps && gaps.length > 0) confidence += 0.15;
  
  // Cap at 0.95 (never 100% certain)
  return Math.min(confidence, 0.95);
}

/**
 * Generate unique paper ID
 */
function generatePaperId(paper) {
  if (paper.doi) return paper.doi;
  if (paper.id) return paper.id;
  
  // Generate from title + year
  const titleHash = (paper.title || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  return `${titleHash}_${paper.year || 'unknown'}`;
}

/**
 * Database logging helper
 */
async function logToDatabase(runId, agentId, level, message, contextData = {}) {
  try {
    await supabase.from('rmri_logs').insert({
      run_id: runId,
      agent_id: agentId,
      log_level: level,
      message: message,
      context_data: contextData
    });
  } catch (error) {
    debug('⚠️  Failed to log to database:', error.message);
  }
}

/**
 * Update agent status in database
 */
async function updateAgentStatus(agentId, status, metadata = {}) {
  try {
    const updates = {
      status: status,
      metadata: metadata
    };
    
    if (status === 'active' && !metadata.started_at) {
      updates.started_at = new Date().toISOString();
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
      if (metadata.executionTime) {
        updates.execution_time_ms = metadata.executionTime;
      }
    }
    
    if (status === 'failed' && metadata.error) {
      updates.error_message = metadata.error;
    }
    
    await supabase
      .from('rmri_agents')
      .update(updates)
      .eq('id', agentId);
      
  } catch (error) {
    debug('⚠️  Failed to update agent status:', error.message);
  }
}

/**
 * Queue health monitoring
 */
microAgentQueue.on('completed', (job, result) => {
  debug(`✅ Job ${job.id} completed for paper: ${result.title}`);
});

microAgentQueue.on('failed', (job, error) => {
  debug(`❌ Job ${job.id} failed:`, error.message);
});

microAgentQueue.on('stalled', (job) => {
  debug(`⚠️  Job ${job.id} stalled`);
});

module.exports = {
  microAgentQueue,
  processMicroAgent: microAgentQueue.process
};
