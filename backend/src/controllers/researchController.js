const { v4: uuidv4 } = require("uuid");
const Bull = require("bull");
const geminiService = require("../services/geminiService");
const { searchMultipleSources } = require("../services/literatureAggregatorService");
const pdfProcessorService = require("../services/pdfProcessorService");
const { embedPaper, embedText } = require("../services/embeddingsService");
const { store } = require("../services/vectorStoreService");
const { searchWorkByTitle } = require("../services/crossrefService");
const { lookupByDOI } = require("../services/unpaywallService");
const openalex = require("../services/openalexService");
const debug = require("debug")("researchai:controller");
const jobStore = require("../services/jobStore");
const chatService = require("../services/chatService");
const { optionalAuth } = require("../middleware/auth");

// Fallback in-memory (kept for safety but Redis store is primary)
const jobs = new Map();
const results = new Map();

const researchQueue = new Bull("research-queue", {
  redis: process.env.REDIS_URL || {
    port: 6379,
    host: "127.0.0.1",
  },
  // Optional limiter for backpressure
  limiter: process.env.RESEARCH_RATE_LIMIT_MAX && process.env.RESEARCH_RATE_LIMIT_DURATION
    ? {
        max: Number(process.env.RESEARCH_RATE_LIMIT_MAX),
        duration: Number(process.env.RESEARCH_RATE_LIMIT_DURATION),
      }
    : undefined,
  settings: {
    // Increase the timeout to 5 minutes to prevent stalling
    lockDuration: 300000,
  },
});

researchQueue.on("error", (error) => {
  debug("Redis connection error: %O", error);
  console.error("Redis connection error:", error);
});

researchQueue.on("failed", (job, error) => {
  debug("Job failed: %s, Error: %O", job.id, error);
  console.error(`Job ${job.id} failed:`, error);
});

researchQueue.on("completed", (job) => {
  debug("Job completed: %s", job.id);
});

const startResearch = async (req, res) => {
  try {
    console.log('Research controller called with:', req.body);
    debug("Starting research job with request: %O", req.body);
    const { query } = req.body;

    if (!query) {
      debug("Query is missing in request body");
      return res
        .status(400)
        .json({ error: true, message: "Query is required" });
    }

    const jobId = uuidv4();
    debug("Generated job ID: %s", jobId);

    const initialJob = {
      id: jobId,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
      query,
    };
    jobs.set(jobId, initialJob);
    await jobStore.setJob(jobId, initialJob);
    debug("Job status initialized: %O", initialJob);

    await researchQueue.add(
      "process-research",
      {
        jobId,
        query,
      },
      {
        attempts: 2,
        // Increased timeout for the job itself to 10 minutes
        timeout: 600000,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      }
    );
    debug("Job added to queue successfully: %s", jobId);

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Research job has been queued",
    });
  } catch (error) {
    debug("Error starting research job: %O", error);
    res.status(500).json({
      error: true,
      message: "Failed to start research job: " + error.message,
    });
  }
};

const getResearchStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = (await jobStore.getJob(jobId)) || jobs.get(jobId);
    if (!job) return res.status(404).json({ error: true, message: "Job not found" });
    res.status(200).json({
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message || "",
      createdAt: job.createdAt,
      updatedAt: job.updatedAt || job.createdAt,
    });
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({ error: true, message: "Failed to get job status" });
  }
};

const getResearchResults = async (req, res) => {
  try {
    const { jobId } = req.params;
    debug("Getting results for job ID: %s", jobId);
    const job = (await jobStore.getJob(jobId)) || jobs.get(jobId);
    if (!job) return res.status(404).json({ error: true, message: "Job not found" });
    if (job.status !== "completed") {
      return res.status(400).json({ error: true, message: `Job is not completed yet. Current status: ${job.status}` });
    }
    const result = (await jobStore.getResult(jobId)) || results.get(jobId);
    if (!result) return res.status(404).json({ error: true, message: "Results not found" });
    res.status(200).json(result);
  } catch (error) {
    debug("Error getting job results: %O", error);
    res.status(500).json({ error: true, message: "Failed to get job results: " + error.message });
  }
};

async function processResearchJob(job) {
  const { jobId, query } = job.data;
  debug("Processing research job: %s with query: %s", jobId, query);

  try {
    updateJobStatus(jobId, "processing", 10, "Expanding research query");
    await job.progress(10);

    const expandedTopics = await geminiService.expandQuery(query);

    updateJobStatus(jobId, "processing", 20, "Searching literature sources (Scholar/Playwright, arXiv, PubMed)");
    await job.progress(20);

    const papersByTopic = {};
    for (let i = 0; i < expandedTopics.length; i++) {
      const topic = expandedTopics[i];
      const progress = 20 + (i / expandedTopics.length) * 30;
      updateJobStatus(jobId, "processing", progress, `Searching: ${topic}`);
      await job.progress(progress);
      try {
        const { merged } = await searchMultipleSources(topic, { sources: process.env.DEFAULT_SOURCES, maxResults: Number(process.env.RESEARCH_MAX_RESULTS || 8) });
        // Cap at RESEARCH_MAX_RESULTS per topic to avoid flooding downstream
        papersByTopic[topic] = merged.slice(0, Number(process.env.RESEARCH_MAX_RESULTS || 8));
      } catch (err) {
        console.error(`Error searching for topic "${topic}":`, err);
        papersByTopic[topic] = [];
      }
    }

    const totalPapers = Object.values(papersByTopic).reduce(
      (sum, papers) => sum + papers.length,
      0
    );
    if (totalPapers === 0) {
      throw new Error(
        "No research papers could be found for the given topics."
      );
    }

    await updateJobStatus(jobId, "processing", 50, "Enriching metadata (Crossref/Unpaywall)");
    await job.progress(50);

    // Parallel enrichment for speed
    const enrichmentPromises = [];
    for (const topic of Object.keys(papersByTopic)) {
      for (const p of papersByTopic[topic]) {
        enrichmentPromises.push(
          (async () => {
            try {
              // Crossref enrichment
              const meta = await searchWorkByTitle(p.title);
              if (meta) {
                if (!p.doi && meta.doi) p.doi = meta.doi;
                if (!p.citationCount && Number.isFinite(meta.citationCount)) p.citationCount = meta.citationCount;
                if (!p.authors && meta.authors) p.authors = meta.authors;
                if (!p.year && meta.year) p.year = String(meta.year);
              }
              
              // OpenAlex enrichment
              const oax = p.doi ? await openalex.lookupByDOI(p.doi) : await openalex.searchByTitle(p.title);
              if (oax) {
                if (!p.doi && oax.doi) p.doi = oax.doi;
                if (!p.citationCount && Number.isFinite(oax.citationCount)) p.citationCount = oax.citationCount;
                if (!p.authors && oax.authors) p.authors = oax.authors;
                if (!p.year && oax.year) p.year = String(oax.year);
                if (!p.publication && oax.hostVenue) p.publication = oax.hostVenue;
                if (!p.pdfUrl && oax.oaUrl) p.pdfUrl = oax.oaUrl;
              }
              
              // Unpaywall enrichment
              if (p.doi) {
                const oa = await lookupByDOI(p.doi);
                if (oa?.oaUrl) p.pdfUrl = p.pdfUrl || oa.oaUrl;
              }
            } catch (error) {
              debug('Enrichment failed for paper: %s', p.title);
            }
          })()
        );
      }
    }
    
    // Wait for all enrichment to complete
    await Promise.all(enrichmentPromises);

    await updateJobStatus(jobId, "processing", 70, "Generating research analysis");
    await job.progress(70);

    console.log("--- Controller: Starting Gemini analysis ---");
    const researchAnalysis = await geminiService.generateResearchAnalysis(
      query,
      papersByTopic
    );
    console.log("--- Controller: Finished Gemini analysis ---");

    const output = {
      query,
      expandedTopics,
      papersByTopic,
      analysis: researchAnalysis,
      totalPapers,
      timestamp: new Date().toISOString()
    };
    results.set(jobId, output);
    await jobStore.setResult(jobId, output);

    await updateJobStatus(jobId, "completed", 100, "Research analysis completed");
    await job.progress(100);
    console.log(`--- Job ${jobId} Completed Successfully ---`);

    return { success: true };
  } catch (error) {
    debug("Error processing research job %s: %O", jobId, error);
    await updateJobStatus(jobId, "failed", 0, `Error: ${error.message}`);
    throw error; // This ensures Bull knows the job failed
  }
}

// Register processor only when enabled (allows splitting worker from API)
// REMOVED: This should only run in the worker process, not in the main API
// if (process.env.ENABLE_RESEARCH_WORKER !== "false") {
//   const concurrency = Number(process.env.RESEARCH_WORKER_CONCURRENCY || 1);
//   researchQueue.process("process-research", concurrency, processResearchJob);
// }

async function updateJobStatus(jobId, status, progress, message) {
  const job = (await jobStore.getJob(jobId)) || jobs.get(jobId);
  const updatedJob = {
    ...(job || { id: jobId, createdAt: new Date() }),
    status,
    progress,
    message,
    updatedAt: new Date(),
  };
  jobs.set(jobId, updatedJob);
  await jobStore.setJob(jobId, updatedJob);
  debug("Updated job status: %s, status: %s, progress: %d%, message: %s", jobId, status, progress, message);
}

module.exports = {
  startResearch,
  getResearchStatus,
  getResearchResults,
  processResearchJob,
};
