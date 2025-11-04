/**
 * Chart Generation Routes
 * Server-side chart rendering and management
 * 
 * Endpoints:
 * - POST /api/workspaces/:id/charts - Generate chart (queued)
 * - GET /api/workspaces/:id/charts - List charts
 * - GET /api/charts/:chartId - Get chart details
 * - DELETE /api/charts/:chartId - Delete chart
 * - GET /api/jobs/:jobId/status - Get job status
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimitChart } = require('../middleware/rateLimit');
const { jobQueueService } = require('../services/jobQueue');
const { chartService } = require('../services/chartService');
const debug = require('debug')('researchai:routes:charts');

const router = express.Router();

/**
 * Generate chart (enqueue job)
 * POST /api/workspaces/:id/charts
 */
router.post('/workspaces/:id/charts', requireAuth, rateLimitChart, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.id;
    const { type, params = {} } = req.body;

    // Validate chart type
    const validTypes = ['citation_trend', 'keyword_network', 'venue_distribution'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chart type',
        message: `Chart type must be one of: ${validTypes.join(', ')}`
      });
    }

    debug(`Enqueueing chart generation: ${type} for workspace ${workspaceId}`);

    // Enqueue job
    const job = await jobQueueService.enqueueChartGeneration(
      workspaceId,
      userId,
      type,
      params
    );

    res.status(202).json({
      success: true,
      message: 'Chart generation job queued',
      job_id: job.job_id,
      status: job.status,
      chart_type: type,
      status_url: `/api/jobs/${job.job_id}/status?type=chart`
    });

  } catch (error) {
    debug(`Chart generation error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to queue chart generation',
      message: error.message
    });
  }
});

/**
 * Get workspace charts
 * GET /api/workspaces/:id/charts
 */
router.get('/workspaces/:id/charts', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;

    debug(`Fetching charts for workspace ${workspaceId}`);

    const charts = await chartService.getWorkspaceCharts(workspaceId);

    res.json({
      success: true,
      data: charts,
      count: charts.length
    });

  } catch (error) {
    debug(`Get charts error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch charts',
      message: error.message
    });
  }
});

/**
 * Delete chart
 * DELETE /api/charts/:chartId
 */
router.delete('/charts/:chartId', requireAuth, async (req, res) => {
  try {
    const chartId = req.params.chartId;
    const userId = req.user.id;

    debug(`Deleting chart ${chartId}`);

    await chartService.deleteChart(chartId, userId);

    res.json({
      success: true,
      message: 'Chart deleted successfully'
    });

  } catch (error) {
    debug(`Delete chart error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to delete chart',
      message: error.message
    });
  }
});

/**
 * Get job status
 * GET /api/jobs/:jobId/status
 */
router.get('/jobs/:jobId/status', requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const queueType = req.query.type || 'chart';

    debug(`Getting status for job ${jobId} (queue: ${queueType})`);

    const status = await jobQueueService.getJobStatus(jobId, queueType);

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    debug(`Get job status error: ${error.message}`);
    res.status(404).json({
      success: false,
      error: 'Job not found',
      message: error.message
    });
  }
});

/**
 * Cancel job
 * DELETE /api/jobs/:jobId
 */
router.delete('/jobs/:jobId', requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const queueType = req.query.type || 'chart';

    debug(`Cancelling job ${jobId} (queue: ${queueType})`);

    await jobQueueService.cancelJob(jobId, queueType);

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    debug(`Cancel job error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

/**
 * Get queue statistics (admin only)
 * GET /api/jobs/stats
 */
router.get('/jobs/stats', requireAuth, async (req, res) => {
  try {
    // TODO: Add admin check
    
    const stats = await jobQueueService.getAllQueueStats();

    res.json({
      success: true,
      ...stats
    });

  } catch (error) {
    debug(`Get queue stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue statistics',
      message: error.message
    });
  }
});

module.exports = router;
