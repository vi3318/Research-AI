const Redis = require("ioredis");
const debug = require("debug")("researchai:cache");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "3600", 10);

/**
 * Get cached JSON value
 */
const getJson = async (key) => {
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch (err) {
    debug("getJson error for %s: %s", key, err.message);
    return null;
  }
};

/**
 * Set cached JSON value with TTL
 */
const setJson = async (key, value, ttlSeconds = DEFAULT_TTL) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    debug("setJson error for %s: %s", key, err.message);
  }
};

module.exports = { getJson, setJson };

/**
 * Scan keys by pattern (prefix*) with an upper bound on count
 * @param {string} pattern
 * @param {number} max
 */
async function scanKeys(pattern, max = 100) {
  try {
    const keys = [];
    let cursor = "0";
    do {
      const res = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = res[0];
      const batch = res[1] || [];
      for (const k of batch) {
        keys.push(k);
        if (keys.length >= max) return keys;
      }
    } while (cursor !== "0");
    return keys;
  } catch (err) {
    debug("scanKeys error for %s: %s", pattern, err.message);
    return [];
  }
}

async function getManyJson(keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  try {
    const pipeline = redis.multi();
    keys.forEach((k) => pipeline.get(k));
    const res = await pipeline.exec();
    return res.map(([, val]) => {
      try {
        return val ? JSON.parse(val) : null;
      } catch (_) {
        return null;
      }
    });
  } catch (err) {
    debug("getManyJson error: %s", err.message);
    return [];
  }
}

module.exports.scanKeys = scanKeys;
module.exports.getManyJson = getManyJson;
module.exports.redis = redis;

