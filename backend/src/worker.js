require("dotenv").config();
const { processResearchJob } = require("./controllers/researchController");
const Bull = require("bull");

const researchQueue = new Bull("research-queue", {
  redis: process.env.REDIS_URL || { port: 6379, host: "127.0.0.1" },
  settings: {
    lockDuration: 300000, // 5 minutes
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
  }
});

const concurrency = Number(process.env.RESEARCH_WORKER_CONCURRENCY || 1);

// Process research jobs
researchQueue.process("process-research", concurrency, async (job) => {
  console.log(`🔄 Processing research job ${job.id} with query: ${job.data.query}`);
  try {
    await processResearchJob(job);
    console.log(`✅ Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error.message);
    throw error; // Re-throw to mark job as failed
  }
});

// Event handlers
researchQueue.on("error", (error) => {
  console.error("❌ Redis connection error:", error);
});

researchQueue.on("failed", (job, error) => {
  console.error(`❌ Job ${job.id} failed:`, error.message);
});

researchQueue.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

researchQueue.on("stalled", (job) => {
  console.warn(`⚠️ Job ${job.id} stalled, retrying...`);
});

console.log(`🚀 Research worker started with concurrency=${concurrency}`);
console.log(`📊 Monitoring queue: research-queue`);
console.log(`🔧 To monitor: redis-cli llen bull:research-queue:wait`);
