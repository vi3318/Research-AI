/**
 * Meta Agent Worker - RMRI System
 * 
 * Synthesizes across domains and iterations:
 * - Combines meso-level thematic clusters
 * - Identifies cross-domain patterns
 * - Ranks research gaps by importance and confidence
 * - Produces final comprehensive synthesis
 * 
 * Implements convergence detection for iterative refinement
 */

const Queue = require('bull');
const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const debug = require('debug')('researchai:meta-agent');
const LLMClients = require('../services/llmClients');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize LLM Clients
const llmClients = new LLMClients();

// Create Bull Queue for meta agent jobs
const metaAgentQueue = new Queue('rmri-meta-agent', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: 50,
    removeOnFail: 50
  }
});

/**
 * Meta Agent Job Processor
 * Cross-domain synthesis and gap ranking
 */
metaAgentQueue.process(async (job) => {
  const { runId, agentId, iteration, llmClient } = job.data;
  const startTime = Date.now();

  try {
    debug(`🌐 Meta Agent ${agentId} starting synthesis for iteration ${iteration}`);

    // Log job start
    await logToDatabase(runId, agentId, 'info',
      `Meta agent started cross-domain synthesis for iteration ${iteration}`
    );

    // Update agent status
    await updateAgentStatus(agentId, 'running', { iteration });

    // Step 1: Read all meso agent outputs
    const mesoOutputs = await readMesoOutputs(runId, iteration);
    
    if (!mesoOutputs || mesoOutputs.length === 0) {
      throw new Error('No meso agent outputs found for synthesis');
    }

    debug(`🔍 Synthesizing ${mesoOutputs.length} meso-level clusters`);

    // Step 2: Read previous iteration (if exists) for convergence check
    const previousMetaOutput = iteration > 1 
      ? await readPreviousMetaOutput(runId, iteration - 1)
      : null;

    // Step 3: Cross-domain pattern identification
    const crossDomainPatterns = identifyCrossDomainPatterns(mesoOutputs);

    // Step 4: Synthesize all identified gaps
    const synthesizedGaps = synthesizeAllGaps(mesoOutputs);

    // Step 5: Rank gaps by importance, novelty, and feasibility
    console.log(`🔄 Starting gap ranking...`);
    const rankedGaps = rankResearchGaps(synthesizedGaps, mesoOutputs);
    console.log(`✅ Ranked ${rankedGaps.length} gaps`);

    // Step 6: Identify research frontiers
    console.log(`🔄 Identifying research frontiers...`);
    const frontiers = identifyResearchFrontiers(mesoOutputs, crossDomainPatterns);
    console.log(`✅ Identified ${frontiers.length} frontiers`);

    // Step 7: Generate actionable research directions
    console.log(`🔄 Generating research directions...`);
    const researchDirections = await generateResearchDirections(rankedGaps, frontiers, llmClient);
    console.log(`✅ Generated ${researchDirections?.length || 0} research directions`);

    // Step 8: Check convergence with previous iteration
    console.log(`🔄 Checking convergence...`);
    const convergence = previousMetaOutput 
      ? checkConvergence(rankedGaps, previousMetaOutput.rankedGaps)
      : { converged: false, similarity: 0, reason: 'First iteration' };
    console.log(`✅ Convergence check complete: ${convergence.converged}`);

    // Step 9: Calculate overall confidence
    console.log(`🔄 Calculating confidence...`);
    const overallConfidence = calculateMetaConfidence(mesoOutputs, rankedGaps, convergence);
    console.log(`✅ Confidence calculated: ${overallConfidence}`);

    // Step 10: Structure meta output
    console.log(`🔄 Structuring meta output with ${rankedGaps.length} gaps...`);
    const metaOutput = {
      iteration: iteration,
      agentId: agentId,
      
      // Core synthesis outputs
      crossDomainPatterns: crossDomainPatterns,
      rankedGaps: rankedGaps.slice(0, 20), // Top 20 gaps
      researchFrontiers: frontiers,
      recommendedDirections: researchDirections,
      
      // Convergence analysis
      convergence: convergence,
      
      // Comprehensive statistics
      statistics: {
        totalClusters: mesoOutputs.reduce((sum, m) => sum + (m.totalClusters || 0), 0),
        totalPapers: mesoOutputs.reduce((sum, m) => sum + (m.totalPapers || 0), 0),
        totalGapsIdentified: synthesizedGaps.length,
        uniqueThemes: extractUniqueThemes(mesoOutputs).length,
        domainsCovered: mesoOutputs.length
      },
      
      // Metadata
      confidence: overallConfidence,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      shouldContinue: !convergence.converged && iteration < 4
    };
    
    console.log(`✅ Meta output structured with ${metaOutput.rankedGaps.length} ranked gaps`);

    // Step 11: Write to context storage
    console.log(`🔄 Writing to context storage...`);
    const contextKey = `meta_output_${iteration}`;
    await contextStorage.writeContext(
      runId,
      agentId,
      contextKey,
      metaOutput,
      'overwrite',
      { iteration, converged: convergence.converged }
    );
    console.log(`✅ Context storage write complete`);

    // Step 11: Store in results table
    console.log(`🔄 Storing in results table...`);
    const { error: dbError } = await supabase.from('rmri_results').insert({
      run_id: runId,
      iteration_number: iteration,
      result_type: 'synthesis',
      data: metaOutput
    });
    
    if (dbError) {
      console.error(`❌ Database insert error:`, dbError);
      throw dbError;
    }
    console.log(`✅ Results table insert complete`);

    // Log completion
    await logToDatabase(runId, agentId, 'info',
      `Meta agent completed: ${rankedGaps.length} gaps ranked, convergence: ${convergence.converged}`
    );

    // Update agent status
    const executionTime = Date.now() - startTime;
    await updateAgentStatus(agentId, 'completed', {
      executionTime,
      gapsRanked: rankedGaps.length,
      converged: convergence.converged,
      confidence: overallConfidence
    });

    debug(`✅ Meta Agent completed in ${executionTime}ms (converged: ${convergence.converged})`);

    console.log(`🎉 RETURNING META OUTPUT with ${metaOutput.rankedGaps.length} gaps`);
    return metaOutput;

  } catch (error) {
    console.error(`❌ META AGENT FULL ERROR for ${agentId}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      runId,
      agentId,
      iteration
    });
    
    debug(`❌ Meta Agent error:`, error.message);

    try {
      await logToDatabase(runId, agentId, 'error',
        `Meta agent failed: ${error.message}`,
        { error: error.stack, errorName: error.name }
      );

      await updateAgentStatus(agentId, 'failed', {
        error: error.message,
        errorStack: error.stack
      });
    } catch (logError) {
      console.error('Failed to log meta error to database:', logError);
    }

    throw error;
  }
});

/**
 * Read all meso outputs for an iteration
 */
async function readMesoOutputs(runId, iteration) {
  try {
    const contexts = await contextStorage.listAvailableContexts(runId);
    
    const mesoContexts = contexts.filter(ctx => 
      ctx.context_key === `meso_output_${iteration}`
    );

    const outputs = [];
    for (const ctx of mesoContexts) {
      const data = await contextStorage.readContext(
        runId,
        ctx.agent_id,
        ctx.context_key,
        false
      );
      
      if (data && data.data) {
        outputs.push(data.data);
      }
    }

    return outputs;

  } catch (error) {
    debug(`❌ Error reading meso outputs:`, error.message);
    throw error;
  }
}

/**
 * Read previous meta output for convergence checking
 */
async function readPreviousMetaOutput(runId, previousIteration) {
  try {
    const contexts = await contextStorage.listAvailableContexts(runId);
    
    const prevContext = contexts.find(ctx => 
      ctx.context_key === `meta_output_${previousIteration}`
    );

    if (!prevContext) return null;

    const data = await contextStorage.readContext(
      runId,
      prevContext.agent_id,
      prevContext.context_key,
      false
    );

    return data?.data || null;

  } catch (error) {
    debug(`⚠️  Could not read previous meta output:`, error.message);
    return null;
  }
}

/**
 * Identify cross-domain patterns
 */
function identifyCrossDomainPatterns(mesoOutputs) {
  const patterns = [];

  // Find recurring themes across domains
  const allThemes = mesoOutputs.flatMap(m => 
    m.clusters.map(c => c.theme.label)
  );
  
  const themeFrequency = {};
  allThemes.forEach(theme => {
    themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
  });

  // Themes appearing in multiple domains
  Object.entries(themeFrequency)
    .filter(([theme, freq]) => freq >= 2)
    .forEach(([theme, freq]) => {
      patterns.push({
        type: 'recurring_theme',
        theme: theme,
        frequency: freq,
        description: `Theme appears across ${freq} domains`,
        confidence: Math.min(0.9, 0.5 + (freq * 0.1))
      });
    });

  // Find methodology overlaps
  const allMethodologies = mesoOutputs.flatMap(m =>
    m.clusters.flatMap(c => c.commonMethodologies.map(meth => meth.method))
  );

  const methodFreq = {};
  allMethodologies.forEach(method => {
    methodFreq[method] = (methodFreq[method] || 0) + 1;
  });

  Object.entries(methodFreq)
    .filter(([method, freq]) => freq >= 3)
    .slice(0, 5)
    .forEach(([method, freq]) => {
      patterns.push({
        type: 'cross_domain_methodology',
        methodology: method,
        frequency: freq,
        description: `Methodology used across multiple themes`,
        confidence: 0.8
      });
    });

  // Temporal patterns
  const allYearRanges = mesoOutputs.flatMap(m =>
    m.clusters.map(c => c.yearRange)
  );

  const overallMinYear = Math.min(...allYearRanges.map(r => r.min));
  const overallMaxYear = Math.max(...allYearRanges.map(r => r.max));

  if (overallMaxYear - overallMinYear > 3) {
    patterns.push({
      type: 'temporal_evolution',
      yearRange: { min: overallMinYear, max: overallMaxYear },
      description: `Research evolution spanning ${overallMaxYear - overallMinYear} years`,
      confidence: 0.85
    });
  }

  return patterns;
}

/**
 * Synthesize all research gaps from meso outputs
 */
function synthesizeAllGaps(mesoOutputs) {
  const allGaps = [];

  console.log(`🔍 Meta: Processing ${mesoOutputs.length} meso outputs`);
  
  mesoOutputs.forEach((mesoOutput, idx) => {
    console.log(`   Meso ${idx}: ${mesoOutput.clusters?.length || 0} clusters`);
    
    // Extract gaps from clusters
    if (mesoOutput.clusters) {
      mesoOutput.clusters.forEach(cluster => {
        const gapsCount = cluster.identifiedGaps?.reduce((sum, g) => sum + (g.gaps?.length || 0), 0) || 0;
        console.log(`     - Cluster ${cluster.clusterId}: ${gapsCount} gaps`);
        
        if (cluster.identifiedGaps) {
          cluster.identifiedGaps.forEach(gapGroup => {
            if (gapGroup.gaps) {
              gapGroup.gaps.forEach(gap => {
                allGaps.push({
                  gap: gap,
                  priority: gapGroup.priority,
                  theme: cluster.theme?.label || 'Unknown',
                  clusterSize: cluster.size,
                  clusterCohesion: cluster.cohesion,
                  source: 'meso_cluster'
                });
              });
            }
          });
        }
      });
    }

    // Extract thematic gaps
    if (mesoOutput.thematicGaps) {
      mesoOutput.thematicGaps.forEach(tGap => {
        allGaps.push({
          gap: tGap.description,
          priority: tGap.priority,
          theme: tGap.theme,
          confidence: tGap.confidence,
          source: 'thematic_analysis'
        });
      });
    }
  });

  console.log(`🎯 Meta: Synthesized ${allGaps.length} total gaps from all meso outputs`);
  return allGaps;
}

/**
 * Rank research gaps by multiple criteria
 */
function rankResearchGaps(gaps, mesoOutputs) {
  // Calculate scores for each gap
  const scoredGaps = gaps.map(gap => {
    // Extract description string from gap object
    const gapDescription = typeof gap.gap === 'string' 
      ? gap.gap 
      : (gap.gap?.description || gap.gap?.gap || 'Unknown gap');
    
    const scores = {
      importance: calculateImportanceScore(gap, mesoOutputs),
      novelty: calculateNoveltyScore(gap),
      feasibility: calculateFeasibilityScore(gap),
      impact: calculateImpactScore(gap)
    };

    const totalScore = 
      scores.importance * 0.35 +
      scores.novelty * 0.25 +
      scores.feasibility * 0.20 +
      scores.impact * 0.20;

    return {
      gap: gapDescription,  // Use 'gap' for frontend compatibility
      type: gap.gap?.type || 'inferred',
      theme: gap.theme,
      priority: gap.priority,
      scores: scores,
      totalScore: totalScore,
      confidence: gap.gap?.confidence || gap.confidence || 0.7,
      source: gap.source,
      rationale: gap.gap?.rationale,
      ranking: 0 // Will be set after sorting
    };
  });

  // Sort by total score
  scoredGaps.sort((a, b) => b.totalScore - a.totalScore);

  // Assign rankings
  scoredGaps.forEach((gap, index) => {
    gap.ranking = index + 1;
  });

  return scoredGaps;
}

/**
 * Calculate importance score for a gap
 */
function calculateImportanceScore(gap, mesoOutputs) {
  let score = 0.5; // Base score

  // High priority gaps get boost
  if (gap.priority === 'high') score += 0.3;
  else if (gap.priority === 'medium') score += 0.15;

  // Gaps from larger clusters are more important
  if (gap.clusterSize) {
    score += Math.min(0.2, gap.clusterSize * 0.02);
  }

  // High cohesion clusters suggest more important gaps
  if (gap.clusterCohesion) {
    score += gap.clusterCohesion * 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate novelty score
 */
function calculateNoveltyScore(gap) {
  let score = 0.5;

  // Extract text from gap (handle both string and object)
  const gapText = (typeof gap.gap === 'string' 
    ? gap.gap 
    : (gap.gap?.description || '')).toLowerCase();

  // Novel if mentions unexplored areas
  const noveltyKeywords = [
    'unexplored', 'novel', 'new', 'emerging',
    'frontier', 'innovative', 'untapped'
  ];

  noveltyKeywords.forEach(keyword => {
    if (gapText.includes(keyword)) score += 0.1;
  });

  // Cross-domain gaps are more novel
  if (gapText.includes('∩') || gapText.includes('intersection')) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate feasibility score
 */
function calculateFeasibilityScore(gap) {
  let score = 0.6; // Moderate feasibility by default

  // Extract text from gap (handle both string and object)
  const gapText = (typeof gap.gap === 'string' 
    ? gap.gap 
    : (gap.gap?.description || '')).toLowerCase();

  // Feasibility indicators
  if (gapText.includes('data available') || gapText.includes('existing')) {
    score += 0.2;
  }

  // Complexity indicators (reduce feasibility)
  const complexityKeywords = [
    'fundamental', 'theoretical', 'long-term',
    'require significant', 'major breakthrough'
  ];

  complexityKeywords.forEach(keyword => {
    if (gapText.includes(keyword)) score -= 0.1;
  });

  return Math.max(0.2, Math.min(score, 1.0));
}

/**
 * Calculate potential impact score
 */
function calculateImpactScore(gap) {
  let score = 0.5;

  // Extract text from gap (handle both string and object)
  const gapText = (typeof gap.gap === 'string' 
    ? gap.gap 
    : (gap.gap?.description || '')).toLowerCase();

  // Impact keywords
  const impactKeywords = [
    'significant', 'important', 'critical', 'essential',
    'breakthrough', 'transformative', 'game-changing'
  ];

  impactKeywords.forEach(keyword => {
    if (gapText.includes(keyword)) score += 0.1;
  });

  // Cross-domain gaps have higher impact potential
  if (gap.source === 'thematic_analysis') {
    score += 0.15;
  }

  return Math.min(score, 1.0);
}

/**
 * Identify research frontiers
 */
function identifyResearchFrontiers(mesoOutputs, crossDomainPatterns) {
  const frontiers = [];

  // Frontier 1: Trending themes
  const trendingThemes = mesoOutputs
    .flatMap(m => m.clusters)
    .filter(c => c.trends && c.trends.length > 0)
    .map(c => ({
      theme: c.theme.label,
      trends: c.trends,
      papers: c.size
    }));

  if (trendingThemes.length > 0) {
    frontiers.push({
      type: 'trending_research',
      themes: trendingThemes.slice(0, 5),
      description: 'Rapidly evolving research areas with increasing activity',
      confidence: 0.8
    });
  }

  // Frontier 2: Cross-domain opportunities
  const crossDomainOpportunities = crossDomainPatterns
    .filter(p => p.type === 'recurring_theme')
    .slice(0, 3);

  if (crossDomainOpportunities.length > 0) {
    frontiers.push({
      type: 'cross_domain_synthesis',
      patterns: crossDomainOpportunities,
      description: 'Opportunities for interdisciplinary research',
      confidence: 0.75
    });
  }

  // Frontier 3: Emerging methodologies
  const emergingMethods = crossDomainPatterns
    .filter(p => p.type === 'cross_domain_methodology')
    .slice(0, 3);

  if (emergingMethods.length > 0) {
    frontiers.push({
      type: 'methodological_innovation',
      methodologies: emergingMethods,
      description: 'New methodological approaches gaining traction',
      confidence: 0.7
    });
  }

  return frontiers;
}

/**
 * Generate actionable research directions
 */
function generateResearchDirections(rankedGaps, frontiers, llmClient) {
  const directions = [];

  // Top 5 high-priority gaps become research directions
  rankedGaps.slice(0, 5).forEach((gap, index) => {
    directions.push({
      priority: index + 1,
      direction: gap.gap,
      theme: gap.theme,
      rationale: `High-impact gap with score ${(gap.totalScore || 0).toFixed(2)}`,
      expectedImpact: gap.scores?.impact || 0.5,
      feasibility: gap.scores?.feasibility || 0.5,
      novelty: gap.scores?.novelty || 0.5,
      confidence: gap.confidence || 0.7
    });
  });

  // Add frontier-based directions
  frontiers.forEach(frontier => {
    if (frontier.type === 'cross_domain_synthesis') {
      directions.push({
        priority: directions.length + 1,
        direction: `Explore intersections between ${frontier.patterns.map(p => p.theme).join(' and ')}`,
        theme: 'cross-domain',
        rationale: 'Cross-domain synthesis opportunity',
        expectedImpact: 0.8,
        feasibility: 0.6,
        novelty: 0.85,
        confidence: frontier.confidence
      });
    }
  });

  return directions.slice(0, 10); // Top 10 directions
}

/**
 * Check convergence between iterations
 */
function checkConvergence(currentGaps, previousGaps) {
  if (!previousGaps || previousGaps.length === 0) {
    return { converged: false, similarity: 0, reason: 'No previous iteration' };
  }

  // Extract gap descriptions
  const currentDescriptions = new Set(currentGaps.slice(0, 10).map(g => g.gap));
  const previousDescriptions = new Set(previousGaps.slice(0, 10).map(g => g.gap));

  // Calculate Jaccard similarity
  const intersection = new Set([...currentDescriptions].filter(x => previousDescriptions.has(x)));
  const union = new Set([...currentDescriptions, ...previousDescriptions]);

  const similarity = union.size > 0 ? intersection.size / union.size : 0;

  // Convergence threshold: 70% similarity in top gaps
  const converged = similarity >= 0.7;

  return {
    converged,
    similarity,
    reason: converged 
      ? `Top gaps stabilized (${(similarity * 100).toFixed(1)}% similarity)`
      : `Still evolving (${(similarity * 100).toFixed(1)}% similarity, threshold 70%)`
  };
}

/**
 * Calculate overall meta-level confidence
 */
function calculateMetaConfidence(mesoOutputs, rankedGaps, convergence) {
  let confidence = 0.6; // Base confidence

  // Higher confidence if we have multiple meso outputs
  if (mesoOutputs.length >= 2) confidence += 0.1;
  if (mesoOutputs.length >= 4) confidence += 0.1;

  // Higher confidence if gaps are well-scored
  const avgGapScore = rankedGaps.slice(0, 10)
    .reduce((sum, g) => sum + g.totalScore, 0) / Math.min(10, rankedGaps.length);
  confidence += avgGapScore * 0.15;

  // Higher confidence if converged
  if (convergence.converged) {
    confidence += 0.15;
  }

  return Math.min(confidence, 0.95);
}

/**
 * Extract unique themes
 */
function extractUniqueThemes(mesoOutputs) {
  const themes = new Set();
  
  mesoOutputs.forEach(m => {
    m.clusters.forEach(c => {
      themes.add(c.theme.label);
    });
  });

  return [...themes];
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
 * Update agent status
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
metaAgentQueue.on('completed', (job, result) => {
  debug(`✅ Meta job ${job.id} completed (converged: ${result.convergence.converged})`);
});

metaAgentQueue.on('failed', (job, error) => {
  debug(`❌ Meta job ${job.id} failed:`, error.message);
});

module.exports = {
  metaAgentQueue,
  processMetaAgent: metaAgentQueue.process
};
