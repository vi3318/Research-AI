const Queue = require('bull');
const paperEmbeddings = require('./paperEmbeddings');
const { ArxivScraper, PubMedScraper, OpenAlexScraper } = require('./paperScrapers');
const { supabase } = require('../config/supabase');

/**
 * Paper Indexing Queue
 * Background worker for scraping and indexing papers asynchronously
 */

// Create Bull queue with Redis connection
const paperQueue = new Queue('paper-indexing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

/**
 * Job processor: Scrape and index papers
 */
paperQueue.process('scrape-and-index', async (job) => {
  const { query, sources, limit } = job.data;
  console.log(`[Queue] Processing job: ${job.id} - Query: "${query}"`);

  try {
    const scrapers = {
      arxiv: new ArxivScraper(),
      pubmed: new PubMedScraper(),
      openalex: new OpenAlexScraper()
    };

    const allPapers = [];
    const papersPerSource = Math.ceil(limit / sources.length);

    // Scrape from each source
    for (const source of sources) {
      const scraper = scrapers[source];
      if (!scraper) continue;

      try {
        job.progress(20);
        const papers = await scraper.search(query, papersPerSource);
        allPapers.push(...papers);
        console.log(`[Queue] Scraped ${papers.length} papers from ${source}`);
      } catch (error) {
        console.error(`[Queue] Error scraping ${source}:`, error.message);
      }
    }

    if (allPapers.length === 0) {
      throw new Error('No papers scraped from any source');
    }

    job.progress(50);

    // Generate embeddings
    console.log(`[Queue] Generating embeddings for ${allPapers.length} papers...`);
    const embeddings = await paperEmbeddings.embedPapersBatch(allPapers);

    job.progress(75);

    // Prepare for insertion
    const papersToInsert = allPapers.map((paper, index) => ({
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract || '',
      year: paper.year,
      source: paper.source,
      source_id: paper.source_id,
      link: paper.link,
      pdf_url: paper.pdf_url,
      doi: paper.doi,
      venue: paper.venue,
      citation_count: paper.citation_count || 0,
      embedding: embeddings[index],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert into database
    const { data, error } = await supabase
      .from('papers')
      .upsert(papersToInsert, { onConflict: 'source,source_id' })
      .select();

    if (error) {
      throw error;
    }

    job.progress(100);

    console.log(`[Queue] Successfully indexed ${data.length} papers`);
    return { success: true, indexed: data.length };

  } catch (error) {
    console.error('[Queue] Job failed:', error);
    throw error;
  }
});

/**
 * Add a scraping job to the queue
 */
function addScrapingJob(query, sources = ['arxiv', 'pubmed', 'openalex'], limit = 10) {
  return paperQueue.add('scrape-and-index', {
    query,
    sources,
    limit
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200 // Keep last 200 failed jobs
  });
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    paperQueue.getWaitingCount(),
    paperQueue.getActiveCount(),
    paperQueue.getCompletedCount(),
    paperQueue.getFailedCount(),
    paperQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Get job status
 */
async function getJobStatus(jobId) {
  const job = await paperQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress(),
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  };
}

// Queue event listeners
paperQueue.on('completed', (job, result) => {
  console.log(`[Queue] Job ${job.id} completed:`, result);
});

paperQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job.id} failed:`, err.message);
});

paperQueue.on('error', (error) => {
  console.error('[Queue] Queue error:', error);
});

module.exports = {
  paperQueue,
  addScrapingJob,
  getQueueStats,
  getJobStatus
};
