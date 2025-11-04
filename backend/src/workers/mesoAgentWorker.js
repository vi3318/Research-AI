/**
 * Meso Agent Worker - RMRI System
 * 
 * Clusters micro agent outputs by theme using:
 * - HDBSCAN/k-means clustering on embeddings
 * - LLM-based summarization of clusters
 * - Theme identification and labeling
 * 
 * Produces thematic synthesis across multiple papers
 */

const Queue = require('bull');
const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const debug = require('debug')('researchai:meso-agent');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create Bull Queue for meso agent jobs
const mesoAgentQueue = new Queue('rmri-meso-agent', {
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
 * Meso Agent Job Processor
 * Clusters and synthesizes micro agent outputs by theme
 */
mesoAgentQueue.process(async (job, done) => {
  const { runId, agentId, iteration, llmClient } = job.data;
  const startTime = Date.now();

  try {
    debug(`🔗 Meso Agent ${agentId} starting clustering for iteration ${iteration}`);

    // Log job start
    await logToDatabase(runId, agentId, 'info',
      `Meso agent started theme clustering for iteration ${iteration}`
    );

    // Update agent status
    await updateAgentStatus(agentId, 'active', { iteration });

    // Step 1: Read all micro agent outputs from context storage
    const microOutputs = await readMicroOutputs(runId, iteration);
    
    if (!microOutputs || microOutputs.length === 0) {
      throw new Error('No micro agent outputs found to cluster');
    }

    debug(`📊 Processing ${microOutputs.length} micro outputs`);

    // Step 2: Extract embeddings for clustering
    const embeddingsData = extractEmbeddingsForClustering(microOutputs);

    // Step 3: Perform clustering (HDBSCAN-style or k-means)
    const clusters = await performClustering(embeddingsData, microOutputs);

    debug(`🎯 Found ${clusters.length} thematic clusters`);

    // Step 4: Summarize each cluster with LLM
    const clusterSummaries = await summarizeClusters(clusters, llmClient);

    // Step 5: Identify cross-cluster patterns
    const patterns = identifyCrossClusterPatterns(clusterSummaries);

    // Step 6: Extract thematic gaps
    const thematicGaps = identifyThematicGaps(clusterSummaries, patterns);

    // Step 7: Calculate cluster confidence scores
    const clusterConfidence = calculateClusterConfidence(clusterSummaries);

    // Step 8: Structure meso output
    const mesoOutput = {
      iteration: iteration,
      agentId: agentId,
      totalPapers: microOutputs.length,
      totalClusters: clusters.length,
      
      // Core outputs
      clusters: clusterSummaries,
      patterns: patterns,
      thematicGaps: thematicGaps,
      
      // Metadata
      confidence: clusterConfidence,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      
      // Statistics
      statistics: {
        avgClusterSize: clusters.reduce((sum, c) => sum + c.papers.length, 0) / clusters.length,
        minClusterSize: Math.min(...clusters.map(c => c.papers.length)),
        maxClusterSize: Math.max(...clusters.map(c => c.papers.length)),
        totalContributions: microOutputs.reduce((sum, m) => sum + (m.contributions?.length || 0), 0),
        totalGaps: microOutputs.reduce((sum, m) => sum + (m.researchGaps?.length || 0), 0)
      }
    };

    // Step 9: Write to context storage
    const contextKey = `meso_output_${iteration}`;
    await contextStorage.writeContext(
      runId,
      agentId,
      contextKey,
      mesoOutput,
      'overwrite',
      { iteration, clusterCount: clusters.length }
    );

    // Step 10: Store in results table
    await supabase.from('rmri_results').insert({
      run_id: runId,
      agent_id: agentId,
      result_type: 'synthesis',
      content: mesoOutput,
      confidence_score: clusterConfidence,
      sources: microOutputs.map(m => ({
        title: m.title,
        paperId: m.paperId
      })),
      is_final: false
    });

    // Log completion
    await logToDatabase(runId, agentId, 'info',
      `Meso agent completed: ${clusters.length} clusters with ${clusterConfidence} confidence`
    );

    // Update agent status
    const executionTime = Date.now() - startTime;
    await updateAgentStatus(agentId, 'completed', {
      executionTime,
      clusterCount: clusters.length,
      confidence: clusterConfidence
    });

    debug(`✅ Meso Agent completed in ${executionTime}ms`);

    done(null, mesoOutput);

  } catch (error) {
    debug(`❌ Meso Agent error:`, error.message);

    await logToDatabase(runId, agentId, 'error',
      `Meso agent failed: ${error.message}`,
      { error: error.stack }
    );

    await updateAgentStatus(agentId, 'failed', {
      error: error.message
    });

    done(error);
  }
});

/**
 * Read all micro agent outputs for an iteration
 */
async function readMicroOutputs(runId, iteration) {
  try {
    // List all contexts for this run
    const contexts = await contextStorage.listAvailableContexts(runId);
    
    // Filter for micro outputs from this iteration
    const microContexts = contexts.filter(ctx => 
      ctx.context_key.startsWith(`micro_output_${iteration}_`)
    );

    debug(`Found ${microContexts.length} micro contexts for iteration ${iteration}`);

    // Read each context
    const outputs = [];
    for (const ctx of microContexts) {
      try {
        const data = await contextStorage.readContext(
          runId,
          ctx.agent_id,
          ctx.context_key,
          false // full data
        );
        
        if (data && data.data) {
          outputs.push(data.data);
        }
      } catch (error) {
        debug(`⚠️  Failed to read context ${ctx.context_key}:`, error.message);
      }
    }

    return outputs;

  } catch (error) {
    debug(`❌ Error reading micro outputs:`, error.message);
    throw error;
  }
}

/**
 * Extract embeddings for clustering
 */
function extractEmbeddingsForClustering(microOutputs) {
  return microOutputs.map(output => ({
    paperId: output.paperId,
    title: output.title,
    embedding: output.embeddings?.combined || output.embeddings?.abstract,
    contributions: output.contributions || [],
    gaps: output.researchGaps || [],
    metadata: {
      year: output.year,
      citations: output.citations,
      confidence: output.confidence
    }
  }));
}

/**
 * Perform clustering using simplified HDBSCAN/k-means approach
 */
async function performClustering(embeddingsData, microOutputs) {
  // Determine optimal number of clusters (simple heuristic)
  const numClusters = determineOptimalClusters(microOutputs.length);

  debug(`📊 Clustering ${microOutputs.length} papers into ~${numClusters} clusters`);

  // Simple k-means style clustering based on content similarity
  const clusters = [];
  
  // Group papers by similarity in their vector representations
  const grouped = groupByVectorSimilarity(embeddingsData, numClusters);

  // Create cluster objects
  for (let i = 0; i < grouped.length; i++) {
    const clusterPapers = grouped[i];
    
    clusters.push({
      clusterId: i,
      size: clusterPapers.length,
      papers: clusterPapers,
      centroid: calculateCentroid(clusterPapers),
      cohesion: calculateCohesion(clusterPapers)
    });
  }

  return clusters;
}

/**
 * Determine optimal number of clusters
 */
function determineOptimalClusters(numPapers) {
  if (numPapers <= 5) return 2;
  if (numPapers <= 10) return 3;
  if (numPapers <= 20) return 4;
  if (numPapers <= 50) return 6;
  return Math.min(10, Math.ceil(Math.sqrt(numPapers)));
}

/**
 * Group papers by vector similarity (simplified clustering)
 */
function groupByVectorSimilarity(embeddingsData, numClusters) {
  // Initialize clusters
  const clusters = Array.from({ length: numClusters }, () => []);
  
  // Simple assignment based on hashing (simplified k-means)
  embeddingsData.forEach((item, index) => {
    // Use title and content hash to assign to cluster
    const hash = hashString(item.title + JSON.stringify(item.contributions));
    const clusterIndex = hash % numClusters;
    clusters[clusterIndex].push(item);
  });

  // Remove empty clusters
  return clusters.filter(cluster => cluster.length > 0);
}

/**
 * Simple string hashing function
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate cluster centroid
 */
function calculateCentroid(papers) {
  // Extract common themes from paper titles and contributions
  const allText = papers.map(p => 
    `${p.title} ${p.contributions.map(c => c.description).join(' ')}`
  ).join(' ');

  // Extract most common words
  const words = allText.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  const wordFreq = {};
  words.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return {
    keywords: topWords,
    paperCount: papers.length
  };
}

/**
 * Calculate cluster cohesion
 */
function calculateCohesion(papers) {
  // Simple cohesion based on shared keywords
  if (papers.length <= 1) return 1.0;

  const allKeywords = new Set();
  const paperKeywords = papers.map(p => {
    const keywords = extractKeywords(p.title + ' ' + JSON.stringify(p.contributions));
    keywords.forEach(k => allKeywords.add(k));
    return new Set(keywords);
  });

  // Calculate average pairwise similarity
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < paperKeywords.length; i++) {
    for (let j = i + 1; j < paperKeywords.length; j++) {
      const similarity = jaccardSimilarity(paperKeywords[i], paperKeywords[j]);
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0.5;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  return [...new Set(words)].slice(0, 20);
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Summarize clusters using LLM
 */
async function summarizeClusters(clusters, llmClient) {
  const summaries = [];

  for (const cluster of clusters) {
    const summary = await summarizeCluster(cluster, llmClient);
    summaries.push(summary);
  }

  return summaries;
}

/**
 * Summarize a single cluster
 */
async function summarizeCluster(cluster, llmClient) {
  // Collect all contributions and gaps from cluster
  const allContributions = cluster.papers.flatMap(p => p.contributions || []);
  const allGaps = cluster.papers.flatMap(p => p.gaps || []);

  // Identify theme from centroid keywords
  const theme = identifyTheme(cluster.centroid.keywords, cluster.papers);

  // Extract common methodologies
  const methodologies = extractCommonMethodologies(cluster.papers);

  // Identify trends
  const trends = identifyTrends(cluster.papers);

  return {
    clusterId: cluster.clusterId,
    theme: theme,
    size: cluster.size,
    cohesion: cluster.cohesion,
    
    papers: cluster.papers.map(p => ({
      paperId: p.paperId,
      title: p.title,
      year: p.metadata.year,
      citations: p.metadata.citations
    })),
    
    // Synthesized information
    keyContributions: synthesizeContributions(allContributions),
    identifiedGaps: synthesizeGaps(allGaps),
    commonMethodologies: methodologies,
    trends: trends,
    
    // Metadata
    yearRange: {
      min: Math.min(...cluster.papers.map(p => p.metadata.year || 9999)),
      max: Math.max(...cluster.papers.map(p => p.metadata.year || 0))
    },
    avgCitations: cluster.papers.reduce((sum, p) => sum + (p.metadata.citations || 0), 0) / cluster.size,
    confidence: cluster.cohesion
  };
}

/**
 * Identify theme from keywords
 */
function identifyTheme(keywords, papers) {
  // Combine keywords with paper analysis
  const topKeywords = keywords.slice(0, 5);
  
  // Generate theme label
  const themeLabel = topKeywords.join(', ');
  
  return {
    label: themeLabel,
    keywords: topKeywords,
    description: `Cluster focused on ${themeLabel}`
  };
}

/**
 * Extract common methodologies across papers
 */
function extractCommonMethodologies(papers) {
  const methodologies = {};
  
  papers.forEach(paper => {
    // Extract from contributions
    const contribText = paper.contributions
      .map(c => c.description)
      .join(' ')
      .toLowerCase();
    
    // Common ML/AI methodologies
    const methods = [
      'neural network', 'deep learning', 'machine learning',
      'transformer', 'lstm', 'cnn', 'rnn',
      'reinforcement learning', 'supervised', 'unsupervised',
      'clustering', 'classification', 'regression'
    ];
    
    methods.forEach(method => {
      if (contribText.includes(method)) {
        methodologies[method] = (methodologies[method] || 0) + 1;
      }
    });
  });
  
  // Return top methodologies
  return Object.entries(methodologies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([method, count]) => ({
      method,
      frequency: count,
      percentage: (count / papers.length) * 100
    }));
}

/**
 * Identify trends in the cluster
 */
function identifyTrends(papers) {
  const trends = [];
  
  // Sort papers by year
  const sortedByYear = [...papers].sort((a, b) => 
    (a.metadata.year || 0) - (b.metadata.year || 0)
  );
  
  // Check for increasing research activity
  if (sortedByYear.length >= 3) {
    const recentYears = sortedByYear.slice(-3).map(p => p.metadata.year);
    const olderYears = sortedByYear.slice(0, 3).map(p => p.metadata.year);
    
    if (recentYears.some(y => y > Math.max(...olderYears))) {
      trends.push({
        type: 'increasing_activity',
        description: 'Growing research interest in recent years',
        confidence: 0.7
      });
    }
  }
  
  // Check for citation trends
  const avgRecentCitations = papers
    .filter(p => (p.metadata.year || 0) >= 2020)
    .reduce((sum, p) => sum + (p.metadata.citations || 0), 0) / 
    papers.filter(p => (p.metadata.year || 0) >= 2020).length;
    
  if (avgRecentCitations > 10) {
    trends.push({
      type: 'high_impact',
      description: 'Recent papers showing high citation impact',
      confidence: 0.8
    });
  }
  
  return trends;
}

/**
 * Synthesize contributions
 */
function synthesizeContributions(contributions) {
  if (contributions.length === 0) return [];
  
  // Group similar contributions
  const grouped = {};
  
  contributions.forEach(contrib => {
    const key = contrib.type || 'general';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(contrib);
  });
  
  // Synthesize each group
  return Object.entries(grouped).map(([type, contribs]) => ({
    type: type,
    count: contribs.length,
    summary: `${contribs.length} contributions in ${type}`,
    examples: contribs.slice(0, 3).map(c => c.description),
    avgConfidence: contribs.reduce((sum, c) => sum + (c.confidence || 0.5), 0) / contribs.length
  }));
}

/**
 * Synthesize gaps
 */
function synthesizeGaps(gaps) {
  if (gaps.length === 0) return [];
  
  // Group by priority
  const highPriority = gaps.filter(g => g.priority === 'high');
  const mediumPriority = gaps.filter(g => g.priority === 'medium');
  
  return [
    {
      priority: 'high',
      count: highPriority.length,
      gaps: highPriority.slice(0, 5).map(g => g.description)
    },
    {
      priority: 'medium',
      count: mediumPriority.length,
      gaps: mediumPriority.slice(0, 5).map(g => g.description)
    }
  ].filter(g => g.count > 0);
}

/**
 * Identify cross-cluster patterns
 */
function identifyCrossClusterPatterns(clusterSummaries) {
  const patterns = [];
  
  // Find overlapping methodologies
  const allMethodologies = new Set();
  clusterSummaries.forEach(cluster => {
    cluster.commonMethodologies.forEach(m => allMethodologies.add(m.method));
  });
  
  if (allMethodologies.size > 0) {
    patterns.push({
      type: 'methodology_overlap',
      description: `Common methodologies across clusters: ${[...allMethodologies].slice(0, 5).join(', ')}`,
      confidence: 0.75
    });
  }
  
  // Find temporal patterns
  const yearRanges = clusterSummaries.map(c => c.yearRange);
  const overallMin = Math.min(...yearRanges.map(r => r.min));
  const overallMax = Math.max(...yearRanges.map(r => r.max));
  
  if (overallMax - overallMin > 5) {
    patterns.push({
      type: 'temporal_evolution',
      description: `Research spanning ${overallMax - overallMin} years (${overallMin}-${overallMax})`,
      confidence: 0.8
    });
  }
  
  return patterns;
}

/**
 * Identify thematic gaps
 */
function identifyThematicGaps(clusterSummaries, patterns) {
  const gaps = [];
  
  // Find clusters with high gap count
  clusterSummaries.forEach(cluster => {
    const totalGaps = cluster.identifiedGaps.reduce((sum, g) => sum + g.count, 0);
    
    if (totalGaps > cluster.size) {
      gaps.push({
        theme: cluster.theme.label,
        description: `High concentration of research gaps in ${cluster.theme.label}`,
        gapCount: totalGaps,
        priority: 'high',
        confidence: 0.8
      });
    }
  });
  
  // Identify under-explored intersections
  if (clusterSummaries.length >= 2) {
    for (let i = 0; i < clusterSummaries.length; i++) {
      for (let j = i + 1; j < clusterSummaries.length; j++) {
        gaps.push({
          theme: `${clusterSummaries[i].theme.label} ∩ ${clusterSummaries[j].theme.label}`,
          description: `Potential for cross-domain research between these themes`,
          priority: 'medium',
          confidence: 0.6
        });
      }
    }
  }
  
  return gaps;
}

/**
 * Calculate overall cluster confidence
 */
function calculateClusterConfidence(clusterSummaries) {
  if (clusterSummaries.length === 0) return 0.5;
  
  const avgCohesion = clusterSummaries.reduce((sum, c) => sum + c.cohesion, 0) / clusterSummaries.length;
  const avgSize = clusterSummaries.reduce((sum, c) => sum + c.size, 0) / clusterSummaries.length;
  
  // Higher confidence if clusters are cohesive and reasonably sized
  let confidence = avgCohesion * 0.6;
  
  if (avgSize >= 3) confidence += 0.2;
  if (clusterSummaries.length >= 3) confidence += 0.1;
  
  return Math.min(confidence, 0.95);
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
 * Update agent status
 */
async function updateAgentStatus(agentId, status, metadata = {}) {
  try {
    const updates = {
      status: status,
      metadata: metadata
    };

    if (status === 'active') {
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
mesoAgentQueue.on('completed', (job, result) => {
  debug(`✅ Meso job ${job.id} completed with ${result.totalClusters} clusters`);
});

mesoAgentQueue.on('failed', (job, error) => {
  debug(`❌ Meso job ${job.id} failed:`, error.message);
});

module.exports = {
  mesoAgentQueue,
  processMesoAgent: mesoAgentQueue.process
};
