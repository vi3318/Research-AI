const { searchMultipleSources } = require("../services/literatureAggregatorService");
const { getJson, setJson } = require("../utils/cache");

const searchLiterature = async (req, res) => {
  try {
    const topic = (req.query.topic || req.body.topic || "").trim();
    const sources = req.query.sources || req.body.sources || undefined;
    const maxResults = parseInt(req.query.maxResults || req.body.maxResults || 10, 10);

    if (!topic) {
      return res.status(400).json({ error: true, message: "topic is required" });
    }

    const cacheKey = `lit:${topic}:${(Array.isArray(sources)?sources.join(','):sources)||'all'}:${maxResults}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.status(200).json({ topic, ...cached, cached: true });
    }

    const result = await searchMultipleSources(topic, { sources, maxResults });
    await setJson(cacheKey, result);
    return res.status(200).json({ topic, ...result });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
};

module.exports = { searchLiterature };