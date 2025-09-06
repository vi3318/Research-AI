const Redis = require("ioredis");
const debug = require("debug")("researchai:jobstore");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

const jobKey = (id) => `job:${id}`;
const resultKey = (id) => `result:${id}`;

async function setJob(id, data) {
  await redis.set(jobKey(id), JSON.stringify(data));
}

async function getJob(id) {
  const val = await redis.get(jobKey(id));
  return val ? JSON.parse(val) : null;
}

async function updateJob(id, updates) {
  const current = (await getJob(id)) || {};
  const merged = { ...current, ...updates };
  await setJob(id, merged);
  return merged;
}

async function setResult(id, data) {
  await redis.set(resultKey(id), JSON.stringify(data));
}

async function getResult(id) {
  const val = await redis.get(resultKey(id));
  return val ? JSON.parse(val) : null;
}

module.exports = { setJob, getJob, updateJob, setResult, getResult };

