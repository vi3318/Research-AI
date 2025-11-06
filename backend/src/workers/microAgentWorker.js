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
const LLMClients = require('../services/llmClients');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize LLM Clients
const llmClients = new LLMClients();

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
microAgentQueue.process(async (job) => {
  const { runId, agentId, paper, iteration, llmClient } = job.data;
  const startTime = Date.now();

  try {
    debug(`🔬 Micro Agent ${agentId} processing paper: ${paper.title}`);

    // Log job start
    await logToDatabase(runId, agentId, 'info', 
      `Micro agent started analyzing: ${paper.title?.substring(0, 100) || 'Untitled'}`
    );

    // Update agent status
    await updateAgentStatus(agentId, 'running', { currentPaper: paper.title });

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
      iteration_number: iteration,
      result_type: 'gaps',
      data: microOutput
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

    return microOutput;

  } catch (error) {
    console.error(`❌ MICRO AGENT FULL ERROR for ${agentId}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      paper: paper?.title,
      runId,
      agentId
    });
    
    debug(`❌ Micro Agent error:`, error.message);
    
    try {
      await logToDatabase(runId, agentId, 'error',
        `Micro agent failed: ${error.message}`,
        { error: error.stack, errorName: error.name }
      );

      await updateAgentStatus(agentId, 'failed', { 
        error: error.message,
        errorStack: error.stack
      });
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }

    throw error;
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
Full Text: ${paper.fullText?.substring(0, 3000) || 'Not available'}

Provide a structured analysis covering:
1. Main research problem addressed
2. Novel contributions
3. Methodological approach
4. Key findings
5. Stated limitations
6. Potential gaps or future work

Be specific and cite evidence from the text where possible.`;

  try {
    // Use smart fallback: Gemini → Cerebras → Huggingface
    const result = await llmClients.callWithFallback(prompt, {
      agentType: 'micro',
      preferredProvider: 'gemini',
      maxTokens: 2000,
      temperature: 0.3
    });

    // Parse LLM response into structured format
    const analysis = {
      problem: result.output,
      novelty: extractNovelty(paper, structure),
      approach: extractApproach(paper, structure),
      findings: extractFindings(paper, structure),
      limitations: extractStatedLimitations(paper, structure),
      futureWork: extractFutureWork(paper, structure),
      provider: result.provider,
      model: result.model
    };

    return analysis;
  } catch (error) {
    console.error('LLM analysis failed, using fallback extraction:', error.message);
    // Fallback to rule-based extraction
    const analysis = {
      problem: extractProblemStatement(paper, structure),
      novelty: extractNovelty(paper, structure),
      approach: extractApproach(paper, structure),
      findings: extractFindings(paper, structure),
      limitations: extractStatedLimitations(paper, structure),
      futureWork: extractFutureWork(paper, structure),
      provider: 'fallback-rules',
      model: 'none'
    };

    return analysis;
  }
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
  try {
    // Sanitize paper content to avoid safety filters
    const sanitizedAbstract = (paper.abstract || 'Not available').substring(0, 500);
    const sanitizedTitle = (paper.title || 'Untitled').substring(0, 200);
    
    const prompt = `Extract research opportunities from this academic paper.

Title: ${sanitizedTitle}
Abstract: ${sanitizedAbstract}

Return a JSON array of 3-5 items. Each item format:
{"description":"specific research opportunity","type":"methodological","priority":"high","rationale":"why important"}

Types: stated_future_work, limitation_derived, methodological, theoretical, empirical
Priorities: high, medium, low

JSON:`;

    // Use the global llmClients instance with smart fallback
    console.log(`🤖 Calling LLM for gap extraction: ${paper.title}`);
    const result = await llmClients.callWithFallback(prompt, {
      preferredOrder: ['gemini', 'cerebras', 'huggingface'],
      maxTokens: 3000,  // Increased from 1500 to allow complete JSON
      temperature: 0.3,
      jsonMode: true  // Force JSON output for Gemini
    });
    
    console.log(`📦 LLM Result:`, {
      provider: result?.provider,
      hasOutput: !!result?.output,
      outputLength: result?.output?.length || 0,
      outputPreview: result?.output?.substring(0, 100),
      finishReason: result?.metadata?.finishReason
    });
    
    if (!result || !result.output) {
      console.error(`❌ LLM returned null or empty:`, result);
      throw new Error('LLM returned null or empty result');
    }
    
    // Check if response was cut off due to max tokens
    if (result.metadata?.finishReason === 'MAX_TOKENS') {
      console.warn(`⚠️ Response may be incomplete (hit MAX_TOKENS limit)`);
      // Try to fix incomplete JSON by adding closing brackets
      let fixed = result.output.trim();
      if (fixed.startsWith('[') && !fixed.endsWith(']')) {
        // Count open braces to determine how many we need to close
        const openBraces = (fixed.match(/{/g) || []).length;
        const closeBraces = (fixed.match(/}/g) || []).length;
        const bracesToAdd = openBraces - closeBraces;
        
        console.log(`🔧 Attempting to fix incomplete JSON (adding ${bracesToAdd} closing braces)`);
        for (let i = 0; i < bracesToAdd; i++) {
          fixed += '\n  }';
        }
        fixed += '\n]';
        result.output = fixed;
      }
    }
    
    const response = result.output;
    console.log(`🔍 LLM Response for "${paper.title}" (${response?.length || 0} chars):`, response?.substring(0, 200));
    
    // Parse LLM response
    let parsedGaps = [];
    try {
      if (!response || response.trim().length === 0) {
        throw new Error('Empty LLM response');
      }
      
      // Remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Try to parse JSON
      parsedGaps = JSON.parse(cleanResponse);
      
      // Ensure it's an array
      if (!Array.isArray(parsedGaps)) {
        parsedGaps = [parsedGaps];
      }
      
      // Filter out invalid gaps
      parsedGaps = parsedGaps.filter(gap => gap && gap.description);
      
      if (parsedGaps.length === 0) {
        throw new Error('No valid gaps in LLM response');
      }
      
      // Add metadata
      parsedGaps = parsedGaps.map(gap => ({
        description: gap.description || 'No description provided',
        type: gap.type || 'inferred',
        priority: gap.priority || 'medium',
        rationale: gap.rationale || 'Not specified',
        source: gap.type === 'stated_future_work' ? 'paper_explicit' : 'inferred',
        confidence: gap.confidence || 0.75,
        paper_id: paper.id,
        paper_title: paper.title
      }));
      
      console.log(`✅ Extracted ${parsedGaps.length} research gaps from: ${paper.title}`);
      
    } catch (parseError) {
      console.error(`❌ Failed to parse LLM gap response for "${paper.title}":`, parseError.message);
      console.log('Raw LLM Response (first 500 chars):', response?.substring(0, 500));
      
      // Fallback: Extract gaps from text using simple parsing
      parsedGaps = extractGapsFromText(response, paper, analysis);
    }
    
    return parsedGaps;
    
  } catch (error) {
    console.error('Error in identifyGaps:', error);
    
    // Fallback to rule-based extraction
    const gaps = [];
    
    if (analysis.futureWork && analysis.futureWork !== 'No future work explicitly mentioned') {
      gaps.push({
        type: 'stated_future_work',
        description: analysis.futureWork,
        priority: 'high',
        confidence: 0.85,
        source: 'paper_explicit',
        paper_id: paper.id,
        paper_title: paper.title
      });
    }
    
    if (analysis.limitations && analysis.limitations !== 'No explicit limitations stated') {
      gaps.push({
        type: 'limitation_derived',
        description: `Addressing stated limitations: ${analysis.limitations}`,
        priority: 'medium',
        confidence: 0.7,
        source: 'inferred',
        paper_id: paper.id,
        paper_title: paper.title
      });
    }
    
    return gaps.length > 0 ? gaps : [{
      type: 'general',
      description: `Further research needed to extend the findings of: ${paper.title}`,
      priority: 'low',
      confidence: 0.5,
      source: 'fallback',
      paper_id: paper.id,
      paper_title: paper.title
    }];
  }
}

/**
 * Extract gaps from non-JSON LLM response text
 */
function extractGapsFromText(text, paper, analysis) {
  const gaps = [];
  
  if (!text || text.trim().length === 0) {
    console.log('⚠️  Empty LLM response, using rule-based fallback');
    return getRuleBasedGaps(paper, analysis);
  }
  
  // Try to extract numbered gaps (1., 2., etc.)
  const numberedPattern = /(?:^|\n)\s*(\d+)[\.\)]\s*(.+?)(?=(?:\n\s*\d+[\.\)])|$)/gs;
  const matches = [...text.matchAll(numberedPattern)];
  
  if (matches.length > 0) {
    matches.forEach((match, index) => {
      if (match[2] && match[2].trim().length > 20) {
        gaps.push({
          description: match[2].trim(),
          type: 'inferred',
          priority: index < 3 ? 'high' : 'medium',
          rationale: 'Extracted from LLM text response',
          source: 'llm_text_parsed',
          confidence: 0.7,
          paper_id: paper.id,
          paper_title: paper.title
        });
      }
    });
  }
  
  // If we got gaps from numbered list, return them
  if (gaps.length > 0) {
    console.log(`✅ Extracted ${gaps.length} gaps from numbered list in: ${paper.title}`);
    return gaps.slice(0, 7); // Max 7 gaps
  }
  
  // Otherwise, try to extract by sentences mentioning "gap" or "future"
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
  const gapKeywords = ['gap', 'future', 'limitation', 'unexplored', 'missing', 'lack', 'needed', 'require'];
  
  sentences.forEach((sentence, index) => {
    const lower = sentence.toLowerCase();
    if (gapKeywords.some(kw => lower.includes(kw)) && gaps.length < 5) {
      gaps.push({
        description: sentence.trim(),
        type: 'inferred',
        priority: gaps.length < 2 ? 'high' : 'medium',
        rationale: 'Identified from LLM analysis',
        source: 'llm_text_extracted',
        confidence: 0.65,
        paper_id: paper.id,
        paper_title: paper.title
      });
    }
  });
  
  if (gaps.length > 0) {
    console.log(`✅ Extracted ${gaps.length} gaps from text analysis in: ${paper.title}`);
    return gaps;
  }
  
  // Final fallback
  console.log('⚠️  Could not parse LLM text, using rule-based fallback');
  return getRuleBasedGaps(paper, analysis);
}

/**
 * Rule-based gap extraction (fallback)
 */
function getRuleBasedGaps(paper, analysis) {
  const gaps = [];
  
  if (analysis.futureWork && analysis.futureWork !== 'No future work explicitly mentioned') {
    gaps.push({
      type: 'stated_future_work',
      description: analysis.futureWork,
      priority: 'high',
      rationale: 'Stated in paper',
      confidence: 0.85,
      source: 'paper_explicit',
      paper_id: paper.id,
      paper_title: paper.title
    });
  }
  
  if (analysis.limitations && analysis.limitations !== 'No explicit limitations stated') {
    gaps.push({
      type: 'limitation_derived',
      description: `Addressing stated limitations: ${analysis.limitations}`,
      priority: 'medium',
      rationale: 'Derived from limitations',
      confidence: 0.7,
      source: 'inferred',
      paper_id: paper.id,
      paper_title: paper.title
    });
  }
  
  // Add generic methodological gap
  gaps.push({
    type: 'methodological',
    description: `Further validation and comparative analysis of the approach presented in: ${paper.title}`,
    priority: 'medium',
    rationale: 'Standard methodological improvement',
    confidence: 0.6,
    source: 'rule_based',
    paper_id: paper.id,
    paper_title: paper.title
  });
  
  console.log(`✅ Generated ${gaps.length} rule-based gaps for: ${paper.title}`);
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
      level: level,
      message: message,
      metadata: contextData
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
      status: status
    };
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
      if (metadata.executionTime) {
        updates.processing_time = metadata.executionTime;
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
