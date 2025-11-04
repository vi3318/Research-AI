/**
 * RMRI Orchestrator - Multi-Agent Coordination System
 * 
 * Orchestrates the complete RMRI workflow:
 * 1. Launches micro agents in parallel for all papers
 * 2. Waits for completion, then launches meso agents
 * 3. Waits for meso completion, then launches meta agent
 * 4. Implements 3-iteration recursive refinement
 * 5. Checks stopping criteria (convergence or max iterations)
 * 
 * Flow: Micro (parallel) → Meso (clustering) → Meta (synthesis) → Repeat until converged
 */

const { createClient } = require('@supabase/supabase-js');
const contextStorage = require('../services/contextStorage');
const { microAgentQueue } = require('./microAgentWorker');
const { mesoAgentQueue } = require('./mesoAgentWorker');
const { metaAgentQueue } = require('./metaAgentWorker');
const debug = require('debug')('researchai:orchestrator');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const CONFIG = {
  MAX_ITERATIONS: 4,
  CONVERGENCE_THRESHOLD: 0.7,
  MICRO_CONCURRENCY: 10, // Process 10 papers at once
  MESO_BATCH_SIZE: 50, // Cluster up to 50 papers per meso agent
  JOB_TIMEOUT: 300000, // 5 minutes per job
  ITERATION_DELAY: 5000 // 5 seconds between iterations
};

class RMRIOrchestrator {
  constructor() {
    this.activeRuns = new Map(); // Track active orchestration runs
  }

  /**
   * Start RMRI orchestration for a research query
   */
  async startOrchestration(runId, papers, llmClient) {
    try {
      debug(`🚀 Starting RMRI orchestration for run ${runId} with ${papers.length} papers`);

      // Check if already running
      if (this.activeRuns.has(runId)) {
        throw new Error(`Orchestration already running for run ${runId}`);
      }

      // Mark as active
      this.activeRuns.set(runId, {
        status: 'running',
        startTime: Date.now(),
        currentIteration: 1
      });

      // Update run status
      await this.updateRunStatus(runId, 'planning', {
        totalPapers: papers.length,
        orchestrationStarted: new Date().toISOString()
      });

      // Log orchestration start
      await this.logOrchestration(runId, 'info',
        `Orchestration started with ${papers.length} papers`
      );

      // Execute iterative refinement
      let iteration = 1;
      let converged = false;
      let finalOutput = null;

      while (iteration <= CONFIG.MAX_ITERATIONS && !converged) {
        debug(`\n🔄 Starting iteration ${iteration}/${CONFIG.MAX_ITERATIONS}`);

        await this.logOrchestration(runId, 'info',
          `Starting iteration ${iteration}`
        );

        // Update run status
        await this.updateRunStatus(runId, 'executing', {
          currentIteration: iteration,
          maxIterations: CONFIG.MAX_ITERATIONS
        });

        // Phase 1: Micro agents (parallel processing)
        const microResults = await this.runMicroPhase(runId, papers, iteration, llmClient);
        debug(`✅ Micro phase completed: ${microResults.length} outputs`);

        // Phase 2: Meso agents (clustering)
        const mesoResults = await this.runMesoPhase(runId, iteration, llmClient);
        debug(`✅ Meso phase completed: ${mesoResults.length} clusters`);

        // Phase 3: Meta agent (synthesis)
        const metaResult = await this.runMetaPhase(runId, iteration, llmClient);
        debug(`✅ Meta phase completed: ${metaResult.rankedGaps.length} gaps ranked`);

        // Check convergence
        converged = metaResult.convergence.converged;
        finalOutput = metaResult;

        await this.logOrchestration(runId, 'info',
          `Iteration ${iteration} complete. Converged: ${converged}`
        );

        if (converged) {
          debug(`🎯 Convergence reached at iteration ${iteration}`);
          await this.logOrchestration(runId, 'info',
            `Convergence achieved: ${metaResult.convergence.reason}`
          );
          break;
        }

        if (iteration < CONFIG.MAX_ITERATIONS) {
          debug(`⏸️  Waiting ${CONFIG.ITERATION_DELAY}ms before next iteration...`);
          await this.sleep(CONFIG.ITERATION_DELAY);
        }

        iteration++;
      }

      // Finalization
      await this.finalizeOrchestration(runId, finalOutput, iteration, converged);

      // Mark as completed
      this.activeRuns.delete(runId);

      debug(`✅ Orchestration completed for run ${runId}`);

      return {
        success: true,
        runId,
        iterations: iteration,
        converged,
        finalOutput
      };

    } catch (error) {
      debug(`❌ Orchestration error for run ${runId}:`, error.message);

      await this.logOrchestration(runId, 'error',
        `Orchestration failed: ${error.message}`,
        { error: error.stack }
      );

      await this.updateRunStatus(runId, 'failed', {
        error: error.message
      });

      this.activeRuns.delete(runId);

      throw error;
    }
  }

  /**
   * Phase 1: Run micro agents in parallel
   */
  async runMicroPhase(runId, papers, iteration, llmClient) {
    try {
      debug(`🔬 Starting micro phase: ${papers.length} papers`);

      await this.logOrchestration(runId, 'info',
        `Micro phase started for ${papers.length} papers`
      );

      // Create micro agent records in database
      const microAgentPromises = papers.map(async (paper, index) => {
        const agentId = await this.createAgent(runId, 'searcher', `micro-${iteration}-${index}`, iteration);
        return { agentId, paper };
      });

      const microAgents = await Promise.all(microAgentPromises);

      // Enqueue jobs for all papers
      const jobs = microAgents.map(({ agentId, paper }) => {
        return microAgentQueue.add({
          runId,
          agentId,
          paper,
          iteration,
          llmClient
        }, {
          timeout: CONFIG.JOB_TIMEOUT,
          jobId: `${runId}-micro-${agentId}`
        });
      });

      // Wait for all micro jobs to complete
      const results = await Promise.all(
        jobs.map(job => job.finished())
      );

      await this.logOrchestration(runId, 'info',
        `Micro phase completed: ${results.length} papers analyzed`
      );

      return results;

    } catch (error) {
      debug(`❌ Micro phase error:`, error.message);
      throw new Error(`Micro phase failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Run meso agents for clustering
   */
  async runMesoPhase(runId, iteration, llmClient) {
    try {
      debug(`🔗 Starting meso phase for iteration ${iteration}`);

      await this.logOrchestration(runId, 'info',
        `Meso phase started for iteration ${iteration}`
      );

      // Create meso agent
      const agentId = await this.createAgent(runId, 'analyzer', `meso-${iteration}`, iteration);

      // Enqueue meso job
      const job = await mesoAgentQueue.add({
        runId,
        agentId,
        iteration,
        llmClient
      }, {
        timeout: CONFIG.JOB_TIMEOUT,
        jobId: `${runId}-meso-${iteration}`
      });

      // Wait for meso job to complete
      const result = await job.finished();

      await this.logOrchestration(runId, 'info',
        `Meso phase completed: ${result.totalClusters} clusters identified`
      );

      return [result]; // Return as array for consistency

    } catch (error) {
      debug(`❌ Meso phase error:`, error.message);
      throw new Error(`Meso phase failed: ${error.message}`);
    }
  }

  /**
   * Phase 3: Run meta agent for synthesis
   */
  async runMetaPhase(runId, iteration, llmClient) {
    try {
      debug(`🌐 Starting meta phase for iteration ${iteration}`);

      await this.logOrchestration(runId, 'info',
        `Meta phase started for iteration ${iteration}`
      );

      // Create meta agent
      const agentId = await this.createAgent(runId, 'synthesizer', `meta-${iteration}`, iteration);

      // Enqueue meta job
      const job = await metaAgentQueue.add({
        runId,
        agentId,
        iteration,
        llmClient
      }, {
        timeout: CONFIG.JOB_TIMEOUT,
        jobId: `${runId}-meta-${iteration}`
      });

      // Wait for meta job to complete
      const result = await job.finished();

      await this.logOrchestration(runId, 'info',
        `Meta phase completed: ${result.rankedGaps.length} gaps identified`
      );

      return result;

    } catch (error) {
      debug(`❌ Meta phase error:`, error.message);
      throw new Error(`Meta phase failed: ${error.message}`);
    }
  }

  /**
   * Finalize orchestration
   */
  async finalizeOrchestration(runId, finalOutput, totalIterations, converged) {
    try {
      debug(`🏁 Finalizing orchestration for run ${runId}`);

      // Store final report
      await supabase.from('rmri_results').insert({
        run_id: runId,
        agent_id: null,
        result_type: 'final_report',
        content: {
          summary: {
            totalIterations,
            converged,
            convergenceReason: finalOutput?.convergence?.reason,
            totalPapers: finalOutput?.statistics?.totalPapers,
            totalClusters: finalOutput?.statistics?.totalClusters,
            topGapsCount: finalOutput?.rankedGaps?.length || 0
          },
          topGaps: finalOutput?.rankedGaps?.slice(0, 10) || [],
          researchDirections: finalOutput?.recommendedDirections || [],
          researchFrontiers: finalOutput?.researchFrontiers || [],
          crossDomainPatterns: finalOutput?.crossDomainPatterns || []
        },
        confidence_score: finalOutput?.confidence || 0.7,
        sources: [],
        is_final: true
      });

      // Update run status
      await this.updateRunStatus(runId, 'completed', {
        totalIterations,
        converged,
        finalConfidence: finalOutput?.confidence,
        completedAt: new Date().toISOString()
      });

      await this.logOrchestration(runId, 'info',
        `Orchestration finalized: ${totalIterations} iterations, converged: ${converged}`
      );

    } catch (error) {
      debug(`⚠️  Finalization error:`, error.message);
      // Don't throw - orchestration already succeeded
    }
  }

  /**
   * Create agent record in database
   */
  async createAgent(runId, agentType, agentName, depthLevel = 0, parentAgentId = null) {
    try {
      const { data, error } = await supabase
        .from('rmri_agents')
        .insert({
          run_id: runId,
          agent_type: agentType,
          agent_name: agentName,
          parent_agent_id: parentAgentId,
          depth_level: depthLevel,
          status: 'pending',
          metadata: {
            created: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      return data.id;

    } catch (error) {
      debug(`❌ Failed to create agent:`, error.message);
      throw error;
    }
  }

  /**
   * Update run status
   */
  async updateRunStatus(runId, status, metadata = {}) {
    try {
      const updates = {
        status,
        metadata: metadata
      };

      if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }

      if (status === 'failed' && metadata.error) {
        updates.error_message = metadata.error;
      }

      await supabase
        .from('rmri_runs')
        .update(updates)
        .eq('id', runId);

    } catch (error) {
      debug(`⚠️  Failed to update run status:`, error.message);
    }
  }

  /**
   * Log orchestration events
   */
  async logOrchestration(runId, level, message, contextData = {}) {
    try {
      await supabase.from('rmri_logs').insert({
        run_id: runId,
        agent_id: null,
        log_level: level,
        message: `[Orchestrator] ${message}`,
        context_data: contextData
      });
    } catch (error) {
      debug('⚠️  Failed to log:', error.message);
    }
  }

  /**
   * Get orchestration status
   */
  getStatus(runId) {
    return this.activeRuns.get(runId) || null;
  }

  /**
   * Check if orchestration is running
   */
  isRunning(runId) {
    return this.activeRuns.has(runId);
  }

  /**
   * Cancel orchestration
   */
  async cancelOrchestration(runId) {
    if (!this.activeRuns.has(runId)) {
      throw new Error(`No active orchestration found for run ${runId}`);
    }

    try {
      // Remove from active runs
      this.activeRuns.delete(runId);

      // Update status
      await this.updateRunStatus(runId, 'cancelled', {
        cancelledAt: new Date().toISOString()
      });

      await this.logOrchestration(runId, 'info', 'Orchestration cancelled by user');

      // Clean up queued jobs
      const jobs = await microAgentQueue.getJobs(['waiting', 'active', 'delayed']);
      const runJobs = jobs.filter(job => job.data.runId === runId);
      
      await Promise.all(runJobs.map(job => job.remove()));

      debug(`✅ Cancelled orchestration for run ${runId}`);

      return { success: true, message: 'Orchestration cancelled' };

    } catch (error) {
      debug(`❌ Error cancelling orchestration:`, error.message);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const microStats = await microAgentQueue.getJobCounts();
      const mesoStats = await mesoAgentQueue.getJobCounts();
      const metaStats = await metaAgentQueue.getJobCounts();

      return {
        micro: microStats,
        meso: mesoStats,
        meta: metaStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debug(`❌ Error getting queue stats:`, error.message);
      return null;
    }
  }

  /**
   * Health check for all queues
   */
  async healthCheck() {
    try {
      const stats = await this.getQueueStats();
      
      const health = {
        status: 'healthy',
        queues: {
          micro: { active: stats.micro.active, waiting: stats.micro.waiting },
          meso: { active: stats.meso.active, waiting: stats.meso.waiting },
          meta: { active: stats.meta.active, waiting: stats.meta.waiting }
        },
        activeRuns: this.activeRuns.size,
        timestamp: new Date().toISOString()
      };

      // Check if any queue has too many failed jobs
      const totalFailed = stats.micro.failed + stats.meso.failed + stats.meta.failed;
      if (totalFailed > 50) {
        health.status = 'degraded';
        health.warning = `High number of failed jobs: ${totalFailed}`;
      }

      return health;

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clean up completed jobs
   */
  async cleanup(olderThanDays = 7) {
    try {
      const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

      const microCleaned = await microAgentQueue.clean(cutoff);
      const mesoCleaned = await mesoAgentQueue.clean(cutoff);
      const metaCleaned = await metaAgentQueue.clean(cutoff);

      debug(`🧹 Cleanup: ${microCleaned + mesoCleaned + metaCleaned} jobs removed`);

      return {
        success: true,
        cleaned: {
          micro: microCleaned,
          meso: mesoCleaned,
          meta: metaCleaned,
          total: microCleaned + mesoCleaned + metaCleaned
        }
      };

    } catch (error) {
      debug(`❌ Cleanup error:`, error.message);
      throw error;
    }
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const orchestrator = new RMRIOrchestrator();

// Queue event handlers for monitoring
microAgentQueue.on('global:progress', (jobId, progress) => {
  debug(`📊 Micro job ${jobId}: ${progress}%`);
});

mesoAgentQueue.on('global:completed', (jobId) => {
  debug(`✅ Meso job ${jobId} completed`);
});

metaAgentQueue.on('global:completed', (jobId) => {
  debug(`✅ Meta job ${jobId} completed`);
});

// Error handlers
microAgentQueue.on('global:failed', (jobId, error) => {
  debug(`❌ Micro job ${jobId} failed:`, error);
});

mesoAgentQueue.on('global:failed', (jobId, error) => {
  debug(`❌ Meso job ${jobId} failed:`, error);
});

metaAgentQueue.on('global:failed', (jobId, error) => {
  debug(`❌ Meta job ${jobId} failed:`, error);
});

module.exports = {
  orchestrator,
  RMRIOrchestrator,
  CONFIG
};
