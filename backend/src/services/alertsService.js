const Bull = require("bull");
const debug = require("debug")("researchai:alerts");
const { searchMultipleSources } = require("./literatureAggregatorService");
const { setJson, getJson } = require("../utils/cache");

const alertsQueue = new Bull("alerts-queue", {
  redis: process.env.REDIS_URL || { port: 6379, host: "127.0.0.1" },
  limiter: process.env.ALERTS_RATE_LIMIT_MAX && process.env.ALERTS_RATE_LIMIT_DURATION
    ? {
        max: Number(process.env.ALERTS_RATE_LIMIT_MAX),
        duration: Number(process.env.ALERTS_RATE_LIMIT_DURATION),
      }
    : undefined,
});

async function scheduleAlert(alertId, topic, cron, sources = "scholar,arxiv,pubmed", maxResults = 20) {
  const job = await alertsQueue.add(
    { alertId, topic, sources, maxResults },
    { repeat: { cron }, removeOnComplete: true, removeOnFail: true }
  );
  await setJson(`alert:${alertId}`, { alertId, topic, cron, sources, maxResults, jobId: job.id });
  return { ok: true };
}

alertsQueue.process(async (job) => {
  const { alertId, topic, sources, maxResults } = job.data;
  try {
    const result = await searchMultipleSources(topic, { sources, maxResults });
    await setJson(`alert_result:${alertId}:${Date.now()}`, result, 7 * 24 * 3600);
    // optional webhook notify
    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        const axios = require("axios");
        await axios.post(process.env.ALERT_WEBHOOK_URL, {
          alertId,
          topic,
          createdAt: new Date().toISOString(),
          counts: Object.fromEntries(Object.entries(result.bySource || {}).map(([k, v]) => [k, (v || []).length])),
        }, { timeout: 5000 });
      } catch (e) {
        debug("Webhook notify failed: %s", e.message);
      }
    }
  } catch (err) {
    debug("Alert processing failed: %s", err.message);
  }
});

module.exports = { scheduleAlert };

