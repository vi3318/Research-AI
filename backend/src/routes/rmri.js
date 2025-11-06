/**
 * RMRI (Recursive Multi-Agent Research Intelligence) Routes
 * Implements the backend API for the RMRI workflow
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const { orchestrator } = require('../workers/orchestrator');
const pdfProcessor = require('../services/pdfProcessorService');
const axios = require('axios');
const debug = require('debug')('researchai:rmri');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware: Validate Supabase JWT token
 */
const validateAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    debug('❌ Auth validation error:', error.message);
    res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

/**
 * POST /api/rmri/start
 * Initialize a new RMRI research run
 */
router.post('/start', validateAuth, async (req, res) => {
  try {
    const { query, config = {}, papers, llmClient = 'cerebras' } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string'
      });
    }

    debug(`🚀 Starting RMRI run for user ${userId}: "${query}"`);
    
    // Extract workspace_id from config - REQUIRED field
    const workspaceId = config.workspace_id || config.workspaceId;
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'workspace_id is required in config'
      });
    }

    // Create RMRI run record
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        query: query.trim(),
        max_iterations: config.maxDepth || 3,
        convergence_threshold: config.convergenceThreshold || 0.7,
        selected_domains: config.domains || ['general'],
        status: 'pending', // Always start as pending
        current_iteration: 0,
        progress_percentage: 0
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create run: ${runError.message}`);
    }

    // Initialize context storage bucket
    await contextStorage.initializeBucket();

    debug(`✅ RMRI run created: ${run.id}`);

    // Return run details immediately
    res.status(201).json({
      success: true,
      data: {
        runId: run.id,
        query: run.query,
        status: run.status,
        maxIterations: run.max_iterations,
        convergenceThreshold: run.convergence_threshold,
        startedAt: run.created_at
      }
    });

    // If papers are provided in the /start request, begin processing immediately
    // Otherwise, client will call /execute separately
    if (papers && Array.isArray(papers) && papers.length > 0) {
      setImmediate(async () => {
        try {
          debug(`🔄 Auto-starting orchestration for run ${run.id} with ${papers.length} papers`);
          
          // Start orchestration asynchronously (non-blocking)
          orchestrator.startOrchestration(run.id, papers, llmClient)
            .then(() => {
              debug(`✅ Orchestration completed for run ${run.id}`);
            })
            .catch(error => {
              debug(`❌ Orchestration failed for run ${run.id}:`, error.message);
              // Update run status to failed
              supabase
                .from('rmri_runs')
                .update({ 
                  status: 'failed',
                  error_message: error.message
                })
                .eq('id', run.id)
                .then(() => debug(`Updated run ${run.id} status to failed`));
            });
        } catch (bgError) {
          debug(`❌ Background processing error for run ${run.id}:`, bgError.message);
        }
      });
    } else {
      debug(`⏸️ Run ${run.id} created, waiting for /execute call with papers`);
    }

  } catch (error) {
    debug('❌ Start RMRI error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start RMRI run'
    });
  }
});

/**
 * GET /api/rmri/runs
 * Get all RMRI runs for the authenticated user
 */
router.get('/runs', validateAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    debug(`📋 Fetching RMRI runs for user: ${userId}`);

    // Try to fetch from rmri_runs table
    const { data: runs, error } = await supabase
      .from('rmri_runs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist or RLS blocks, return empty array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        debug('⚠️ rmri_runs table not found, returning empty array');
        return res.json({
          success: true,
          runs: []
        });
      }
      throw new Error(`Failed to fetch runs: ${error.message}`);
    }

    res.json({
      success: true,
      runs: runs || []
    });

  } catch (error) {
    debug('❌ Fetch runs error:', error.message);
    // Return empty array instead of error to avoid breaking UI
    res.json({
      success: true,
      runs: []
    });
  }
});

/**
 * GET /api/rmri/:id/status
 * Get status and progress of an RMRI run
 */
router.get('/:id/status', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;

    debug(`📊 Getting status for run ${runId}`);

    // Get run details
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Get agent statistics
    const { data: agents, error: agentsError } = await supabase
      .from('rmri_agents')
      .select('id, agent_type, status, iteration_number, processing_time')
      .eq('run_id', runId);

    if (agentsError) {
      debug('⚠️  Failed to fetch agents:', agentsError.message);
    }

    // Calculate progress metrics
    const agentStats = {
      total: agents?.length || 0,
      pending: agents?.filter(a => a.status === 'pending').length || 0,
      running: agents?.filter(a => a.status === 'running').length || 0,
      completed: agents?.filter(a => a.status === 'completed').length || 0,
      failed: agents?.filter(a => a.status === 'failed').length || 0,
      byType: {}
    };

    // Group by agent type
    agents?.forEach(agent => {
      if (!agentStats.byType[agent.agent_type]) {
        agentStats.byType[agent.agent_type] = {
          total: 0,
          completed: 0,
          running: 0,
          failed: 0
        };
      }
      agentStats.byType[agent.agent_type].total++;
      if (agent.status === 'completed') agentStats.byType[agent.agent_type].completed++;
      if (agent.status === 'running') agentStats.byType[agent.agent_type].running++;
      if (agent.status === 'failed') agentStats.byType[agent.agent_type].failed++;
    });

    // Calculate progress percentage
    const progress = agentStats.total > 0 
      ? Math.round((agentStats.completed / agentStats.total) * 100)
      : 0;

    // Get latest logs (last 10)
    const { data: recentLogs } = await supabase
      .from('rmri_logs')
      .select('level, message, created_at')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate elapsed time
    const elapsedMs = run.completed_at 
      ? new Date(run.completed_at) - new Date(run.created_at)
      : Date.now() - new Date(run.created_at);

    res.json({
      success: true,
      data: {
        runId: run.id,
        query: run.query,
        status: run.status,
        progress,
        currentIteration: run.current_iteration,
        maxIterations: run.max_iterations,
        agents: agentStats,
        elapsedMs,
        createdAt: run.created_at,
        completedAt: run.completed_at,
        errorMessage: run.error_message,
        logs: recentLogs || []
      }
    });

  } catch (error) {
    debug('❌ Get status error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get run status'
    });
  }
});

/**
 * GET /api/rmri/:id/results
 * Get results from an RMRI run
 */
router.get('/:id/results', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;
    const { type, finalOnly = 'false' } = req.query;

    debug(`📊 Getting results for run ${runId}`);

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id, status')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Build query for results
    let query = supabase
      .from('rmri_results')
      .select(`
        id,
        run_id,
        iteration_number,
        result_type,
        data,
        created_at
      `)
      .eq('run_id', runId);

    if (type) {
      query = query.eq('result_type', type);
    }

    // For finalOnly, get results from the last iteration
    if (finalOnly === 'true') {
      const { data: lastIteration } = await supabase
        .from('rmri_iterations')
        .select('iteration_number')
        .eq('run_id', runId)
        .order('iteration_number', { ascending: false })
        .limit(1)
        .single();
      
      if (lastIteration) {
        query = query.eq('iteration_number', lastIteration.iteration_number);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data: results, error: resultsError } = await query;

    if (resultsError) {
      throw new Error(`Failed to fetch results: ${resultsError.message}`);
    }

    res.json({
      success: true,
      data: {
        runId,
        status: run.status,
        resultsCount: results?.length || 0,
        results: results || []
      }
    });

  } catch (error) {
    debug('❌ Get results error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get results'
    });
  }
});

/**
 * POST /api/rmri/writecontext
 * Write context data for an agent
 */
router.post('/writecontext', validateAuth, async (req, res) => {
  try {
    const { runId, agentId, contextKey, data, mode = 'overwrite', metadata = {} } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!runId || !agentId || !contextKey || data === undefined) {
      return res.status(400).json({
        success: false,
        error: 'runId, agentId, contextKey, and data are required'
      });
    }

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(403).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    debug(`📝 Writing context ${contextKey} for agent ${agentId}`);

    // Write context using storage service
    const result = await contextStorage.writeContext(
      runId,
      agentId,
      contextKey,
      data,
      mode,
      metadata
    );

    // Log the operation
    await supabase
      .from('rmri_logs')
      .insert({
        run_id: runId,
        level: 'info',
        message: `Context written: ${contextKey} (${mode})`,
        metadata: { 
          contextKey, 
          mode, 
          sizeBytes: result.sizeBytes 
        }
      });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    debug('❌ Write context error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to write context'
    });
  }
});

/**
 * POST /api/rmri/readcontext
 * Read context data for an agent
 */
router.post('/readcontext', validateAuth, async (req, res) => {
  try {
    const { runId, agentId, contextKey, summaryOnly = false, version } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!runId) {
      return res.status(400).json({
        success: false,
        error: 'runId is required'
      });
    }

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(403).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    debug(`📖 Reading context ${contextKey || 'all'} for agent ${agentId || 'all'}`);

    // Read context using storage service
    const result = await contextStorage.readContext(
      runId,
      agentId,
      contextKey,
      summaryOnly,
      version
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    debug('❌ Read context error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to read context'
    });
  }
});

/**
 * GET /api/rmri/listcontexts
 * List all available contexts for a run
 */
router.get('/listcontexts', validateAuth, async (req, res) => {
  try {
    const { runId, agentId } = req.query;
    const userId = req.user.id;

    // Validate inputs
    if (!runId) {
      return res.status(400).json({
        success: false,
        error: 'runId query parameter is required'
      });
    }

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(403).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    debug(`📋 Listing contexts for run ${runId}`);

    // List contexts using storage service
    const contexts = await contextStorage.listAvailableContexts(runId, agentId);

    res.json({
      success: true,
      data: {
        runId,
        agentId: agentId || 'all',
        count: contexts.length,
        contexts
      }
    });

  } catch (error) {
    debug('❌ List contexts error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list contexts'
    });
  }
});

/**
 * GET /api/rmri/:id/agents
 * Get all agents for a run
 */
router.get('/:id/agents', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from('rmri_agents')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    res.json({
      success: true,
      data: {
        runId,
        count: agents?.length || 0,
        agents: agents || []
      }
    });

  } catch (error) {
    debug('❌ Get agents error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get agents'
    });
  }
});

/**
 * GET /api/rmri/:id/logs
 * Get logs for a run
 */
router.get('/:id/logs', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;
    const { level, limit = 100, offset = 0 } = req.query;

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Build query
    let query = supabase
      .from('rmri_logs')
      .select('*')
      .eq('run_id', runId);

    if (level) {
      query = query.eq('level', level);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      throw new Error(`Failed to fetch logs: ${logsError.message}`);
    }

    res.json({
      success: true,
      data: {
        runId,
        count: logs?.length || 0,
        logs: logs || []
      }
    });

  } catch (error) {
    debug('❌ Get logs error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get logs'
    });
  }
});

/**
 * POST /api/rmri/:id/execute
 * Execute the RMRI orchestration for a run
 */
router.post('/:id/execute', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;
    const { papers, llmClient = 'cerebras' } = req.body;

    // Validate papers
    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Papers array is required and must not be empty'
      });
    }

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id, status')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Check if already running
    if (orchestrator.isRunning(runId)) {
      return res.status(409).json({
        success: false,
        error: 'Orchestration already running for this run'
      });
    }

    debug(`🚀 Executing RMRI orchestration for run ${runId} with ${papers.length} papers`);
    console.log(`🚀 Executing RMRI orchestration for run ${runId} with ${papers.length} papers`);

    // Process papers to extract PDF content
    console.log('📄 Processing papers and extracting PDF content...');
    const processedPapers = await Promise.all(papers.map(async (paper) => {
      try {
        let fullText = '';
        let abstract = '';
        
        // If paper has a URL, try to fetch and extract PDF
        if (paper.url) {
          try {
            console.log(`📥 Fetching PDF from: ${paper.url}`);
            const response = await axios.get(paper.url, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
              }
            });
            
            const pdfBuffer = Buffer.from(response.data);
            const extracted = await pdfProcessor.processPDFBuffer(pdfBuffer);
            fullText = extracted.text || '';
            console.log(`✅ Extracted ${fullText.length} characters from ${paper.title}`);
          } catch (pdfError) {
            console.warn(`⚠️  Could not extract PDF for ${paper.title}:`, pdfError.message);
            fullText = `Title: ${paper.title}\n\n[PDF content extraction failed]`;
          }
        }
        
        return {
          ...paper,
          content: fullText,
          fullText: fullText,
          abstract: abstract || fullText.substring(0, 500), // First 500 chars as abstract fallback
          fileName: paper.fileName || `paper_${Date.now()}.pdf`,
          // Add missing properties with defaults
          id: paper.id || `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          authors: paper.authors || [],
          year: paper.year || new Date().getFullYear(),
          venue: paper.venue || 'Unknown',
          citations: paper.citations || 0,
          doi: paper.doi || null,
          references: paper.references || []
        };
      } catch (error) {
        console.error(`❌ Error processing paper ${paper.title}:`, error);
        // Return paper with minimal content to avoid breaking the flow
        return {
          ...paper,
          content: `Title: ${paper.title}\n\n[Processing failed]`,
          fullText: `Title: ${paper.title}`,
          abstract: '',
          id: `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          authors: [],
          year: new Date().getFullYear(),
          venue: 'Unknown',
          citations: 0,
          doi: null,
          references: []
        };
      }
    }));

    console.log(`✅ Processed ${processedPapers.length} papers`);

    // Start orchestration asynchronously with processed papers
    orchestrator.startOrchestration(runId, processedPapers, llmClient)
      .then(() => {
        console.log(`✅ Orchestration completed successfully for run ${runId}`);
      })
      .catch(error => {
        console.error(`❌ Orchestration background error for run ${runId}:`, error);
        debug(`❌ Orchestration background error:`, error.message);
      });

    res.json({
      success: true,
      message: 'Orchestration started',
      data: {
        runId,
        papersCount: papers.length,
        status: 'executing'
      }
    });

  } catch (error) {
    debug('❌ Execute error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute orchestration'
    });
  }
});

/**
 * POST /api/rmri/:id/cancel
 * Cancel running orchestration
 */
router.post('/:id/cancel', validateAuth, async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.id;

    // Verify run ownership
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .select('id')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found or access denied'
      });
    }

    // Cancel orchestration
    const result = await orchestrator.cancelOrchestration(runId);

    res.json({
      success: true,
      message: 'Orchestration cancelled',
      data: result
    });

  } catch (error) {
    debug('❌ Cancel error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel orchestration'
    });
  }
});

/**
 * GET /api/rmri/health
 * Health check for RMRI orchestration system
 */
router.get('/health', async (req, res) => {
  try {
    const health = await orchestrator.healthCheck();
    const status = health.status === 'healthy' ? 200 : 503;
    
    res.status(status).json({
      success: health.status === 'healthy',
      data: health
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
});

/**
 * GET /api/rmri/queue-stats
 * Get queue statistics
 */
router.get('/queue-stats', validateAuth, async (req, res) => {
  try {
    const stats = await orchestrator.getQueueStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    debug('❌ Queue stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue stats'
    });
  }
});

module.exports = router;
