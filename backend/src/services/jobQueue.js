/**
 * Job Queue Service
 * Redis + Bull for background tasks
 * 
 * Queues:
 * - chartGeneration: Server-side chart rendering
 * - paperMetadata: Fetch paper metadata from external APIs
 * - batchHumanize: Batch text humanization
 */

const Queue = require('bull');
const debug = require('debug')('researchai:jobs');
const { chartService } = require('./chartService');
const { paperService } = require('./paperService');
const { humanizerService } = require('./humanizer');

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queues
const chartQueue = new Queue('chartGeneration', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500 // Keep last 500 failed jobs
  }
});

const paperMetadataQueue = new Queue('paperMetadata', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

const humanizeQueue = new Queue('batchHumanize', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 3000
    },
    removeOnComplete: 50,
    removeOnFail: 200
  }
});

/**
 * Chart Generation Worker
 */
chartQueue.process(async (job) => {
  const { workspaceId, userId, chartType, params } = job.data;
  
  debug(`Processing chart generation job ${job.id}: ${chartType} for workspace ${workspaceId}`);
  
  try {
    // Update progress
    await job.progress(10);
    
    // Generate chart
    const result = await chartService.generateChart(
      workspaceId,
      userId,
      chartType,
      params
    );
    
    await job.progress(100);
    
    debug(`Chart generation job ${job.id} completed`);
    
    return result;
  } catch (error) {
    debug(`Chart generation job ${job.id} failed: ${error.message}`);
    throw error;
  }
});

/**
 * Paper Metadata Worker
 */
paperMetadataQueue.process(async (job) => {
  const { paper_id, refresh = false } = job.data;
  
  debug(`Processing paper metadata job ${job.id}: ${paper_id}`);
  
  try {
    await job.progress(20);
    
    // Fetch metadata
    const metadata = await paperService.fetchPaperMetadata(paper_id);
    
    await job.progress(100);
    
    debug(`Paper metadata job ${job.id} completed`);
    
    return metadata;
  } catch (error) {
    debug(`Paper metadata job ${job.id} failed: ${error.message}`);
    throw error;
  }
});

/**
 * Batch Humanize Worker
 */
humanizeQueue.process(async (job) => {
  const { texts, options = {} } = job.data;
  
  debug(`Processing batch humanize job ${job.id}: ${texts.length} texts`);
  
  try {
    const results = [];
    const totalTexts = texts.length;
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      
      try {
        const result = await humanizerService.humanize(text, options);
        results.push(result);
      } catch (error) {
        results.push({
          error: error.message,
          original: text
        });
      }
      
      // Update progress
      const progress = Math.floor(((i + 1) / totalTexts) * 100);
      await job.progress(progress);
    }
    
    debug(`Batch humanize job ${job.id} completed: ${results.length} texts processed`);
    
    return results;
  } catch (error) {
    debug(`Batch humanize job ${job.id} failed: ${error.message}`);
    throw error;
  }
});

/**
 * Job Queue Service
 */
class JobQueueService {
  constructor() {
    this.queues = {
      chart: chartQueue,
      paperMetadata: paperMetadataQueue,
      humanize: humanizeQueue
    };

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for monitoring
   */
  setupEventListeners() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('completed', (job, result) => {
        debug(`[${name}] Job ${job.id} completed`);
      });

      queue.on('failed', (job, error) => {
        debug(`[${name}] Job ${job.id} failed: ${error.message}`);
      });

      queue.on('stalled', (job) => {
        debug(`[${name}] Job ${job.id} stalled`);
      });
    });
  }

  /**
   * Enqueue chart generation
   */
  async enqueueChartGeneration(workspaceId, userId, chartType, params = {}) {
    const job = await chartQueue.add({
      workspaceId,
      userId,
      chartType,
      params
    }, {
      priority: params.priority || 5,
      timeout: 60000 // 1 minute timeout
    });

    debug(`Enqueued chart generation job ${job.id}`);

    return {
      job_id: job.id,
      status: 'queued',
      type: 'chart_generation',
      chartType
    };
  }

  /**
   * Enqueue paper metadata fetch
   */
  async enqueuePaperMetadata(paper_id, refresh = false) {
    const job = await paperMetadataQueue.add({
      paper_id,
      refresh
    }, {
      jobId: `paper_${paper_id}`, // Deduplicate by paper ID
      timeout: 30000 // 30 second timeout
    });

    debug(`Enqueued paper metadata job ${job.id}`);

    return {
      job_id: job.id,
      status: 'queued',
      type: 'paper_metadata',
      paper_id
    };
  }

  /**
   * Enqueue batch humanization
   */
  async enqueueBatchHumanize(texts, options = {}) {
    const job = await humanizeQueue.add({
      texts,
      options
    }, {
      priority: 3,
      timeout: texts.length * 10000 // 10 seconds per text
    });

    debug(`Enqueued batch humanize job ${job.id}`);

    return {
      job_id: job.id,
      status: 'queued',
      type: 'batch_humanize',
      text_count: texts.length
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId, queueType = 'chart') {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();
    const reason = job.failedReason;

    return {
      job_id: jobId,
      status: state,
      progress: progress || 0,
      data: job.data,
      result: state === 'completed' ? await job.finished() : null,
      error: reason || null,
      created_at: job.timestamp,
      processed_at: job.processedOn,
      finished_at: job.finishedOn,
      attempts: job.attemptsMade
    };
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId, queueType = 'chart') {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    debug(`Cancelled job ${jobId}`);

    return { success: true };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueType = 'chart') {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      queue: queueType,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats() {
    const stats = await Promise.all(
      Object.keys(this.queues).map(type => this.getQueueStats(type))
    );

    return {
      queues: stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(queueType = 'chart', olderThan = 24 * 60 * 60 * 1000) {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    await queue.clean(olderThan, 'completed');
    await queue.clean(olderThan * 7, 'failed'); // Keep failed jobs longer

    debug(`Cleaned old jobs from ${queueType} queue`);

    return { success: true };
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueType) {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    await queue.pause();
    debug(`Paused ${queueType} queue`);

    return { success: true };
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueType) {
    const queue = this.queues[queueType];
    if (!queue) {
      throw new Error(`Unknown queue type: ${queueType}`);
    }

    await queue.resume();
    debug(`Resumed ${queueType} queue`);

    return { success: true };
  }

  /**
   * Close all queues (for graceful shutdown)
   */
  async close() {
    await Promise.all(
      Object.values(this.queues).map(queue => queue.close())
    );
    debug('All queues closed');
  }
}

// Export singleton
const jobQueueService = new JobQueueService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  debug('SIGTERM received, closing queues...');
  await jobQueueService.close();
  process.exit(0);
});

module.exports = {
  jobQueueService,
  JobQueueService,
  chartQueue,
  paperMetadataQueue,
  humanizeQueue
};
