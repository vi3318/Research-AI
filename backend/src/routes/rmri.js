/**
 * RMRI (Recursive Multi-Agent Research Intelligence) Routes
 * Implements the backend API for the RMRI workflow
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const { orchestrator } = require('../workers/orchestrator');
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
    const { query, config = {} } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string'
      });
    }

    debug(`🚀 Starting RMRI run for user ${userId}: "${query}"`);

    // Create RMRI run record
    const { data: run, error: runError } = await supabase
      .from('rmri_runs')
      .insert({
        user_id: userId,
        query: query.trim(),
        status: 'initializing',
        config: {
          maxDepth: config.maxDepth || 3,
          maxAgents: config.maxAgents || 20,
          timeout: config.timeout || 300000, // 5 minutes default
          confidenceThreshold: config.confidenceThreshold || 0.7,
          enableCritic: config.enableCritic !== false,
          ...config
        },
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          startedBy: req.user.email
        }
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create run: ${runError.message}`);
    }

    // Log initialization
    await supabase
      .from('rmri_logs')
      .insert({
        run_id: run.id,
        log_level: 'info',
        message: `RMRI run initialized with query: "${query}"`,
        context_data: { config: run.config }
      });

    // Initialize context storage bucket
    await contextStorage.initializeBucket();

    debug(`✅ RMRI run created: ${run.id}`);

    // Return run details
    res.status(201).json({
      success: true,
      data: {
        runId: run.id,
        query: run.query,
        status: run.status,
        config: run.config,
        startedAt: run.started_at
      }
    });

    // Note: Actual agent execution will be triggered by a separate service/queue
    // This endpoint only initializes the run and returns immediately

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
      .select('id, agent_type, status, depth_level, execution_time_ms')
      .eq('run_id', runId);

    if (agentsError) {
      debug('⚠️  Failed to fetch agents:', agentsError.message);
    }

    // Calculate progress metrics
    const agentStats = {
      total: agents?.length || 0,
      pending: agents?.filter(a => a.status === 'pending').length || 0,
      active: agents?.filter(a => a.status === 'active').length || 0,
      completed: agents?.filter(a => a.status === 'completed').length || 0,
      failed: agents?.filter(a => a.status === 'failed').length || 0,
      skipped: agents?.filter(a => a.status === 'skipped').length || 0,
      byType: {}
    };

    // Group by agent type
    agents?.forEach(agent => {
      if (!agentStats.byType[agent.agent_type]) {
        agentStats.byType[agent.agent_type] = {
          total: 0,
          completed: 0,
          active: 0,
          failed: 0
        };
      }
      agentStats.byType[agent.agent_type].total++;
      if (agent.status === 'completed') agentStats.byType[agent.agent_type].completed++;
      if (agent.status === 'active') agentStats.byType[agent.agent_type].active++;
      if (agent.status === 'failed') agentStats.byType[agent.agent_type].failed++;
    });

    // Calculate progress percentage
    const progress = agentStats.total > 0 
      ? Math.round((agentStats.completed / agentStats.total) * 100)
      : 0;

    // Get latest logs (last 10)
    const { data: recentLogs } = await supabase
      .from('rmri_logs')
      .select('log_level, message, timestamp')
      .eq('run_id', runId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Calculate elapsed time
    const elapsedMs = run.completed_at 
      ? new Date(run.completed_at) - new Date(run.started_at)
      : Date.now() - new Date(run.started_at);

    res.json({
      success: true,
      data: {
        runId: run.id,
        query: run.query,
        status: run.status,
        progress,
        agents: agentStats,
        elapsedMs,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        errorMessage: run.error_message,
        recentLogs: recentLogs || [],
        config: run.config
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
        agent_id,
        result_type,
        content,
        confidence_score,
        sources,
        is_final,
        created_at,
        rmri_agents(agent_name, agent_type)
      `)
      .eq('run_id', runId);

    if (type) {
      query = query.eq('result_type', type);
    }

    if (finalOnly === 'true') {
      query = query.eq('is_final', true);
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
        agent_id: agentId,
        log_level: 'info',
        message: `Context written: ${contextKey} (${mode})`,
        context_data: { 
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
      query = query.eq('log_level', level);
    }

    query = query
      .order('timestamp', { ascending: false })
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
    const { papers, llmClient = 'gemini' } = req.body;

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

    // Start orchestration asynchronously
    orchestrator.startOrchestration(runId, papers, llmClient)
      .catch(error => {
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
