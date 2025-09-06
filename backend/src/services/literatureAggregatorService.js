const debug = require("debug")("researchai:litagg");
const scholar = require("./scholarScraperService");
const { searchArxiv } = require("./arxivService");
const { searchPubMed } = require("./pubmedService");
const openalex = require("./openalexService");
const { searchByTopic } = require("./unpaywallService");
const { withRetry } = require("../utils/retry");

/**
 * Search multiple sources concurrently for a topic
 * @param {string} topic
 * @param {{sources?: string[]|string, maxResults?: number}} options
 * @returns {Promise<{bySource: Record<string, any[]>, merged: any[]}>}
 */
const searchMultipleSources = async (topic, options = {}) => {
  const maxResults = options.maxResults || 10;
  let sources = options.sources || (process.env.DEFAULT_SOURCES ? String(process.env.DEFAULT_SOURCES) : "scholar,arxiv,pubmed,openalex,unpaywall");
  if (typeof sources === "string") {
    sources = sources.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  // Allow disabling Scholar globally to avoid CAPTCHA/slowdowns
  if (process.env.SCHOLAR_ENABLED === "false") {
    sources = sources.filter((s) => s !== "scholar");
  }

  console.log('🔍 Literature aggregator searching sources:', sources.join(', '));

  const tasks = [];
  const bySource = {};

  if (sources.includes("scholar")) {
    tasks.push(
      withRetry(() => scholar.searchScholar(topic, maxResults), {
        retries: 1,
        minDelayMs: 2000,
        factor: 2,
        onRetry: (e, a, d) => debug("Retry scholar attempt %d: %s (%dms)", a, e.message, d),
      })
        .then((res) => {
          bySource.scholar = res;
          console.log(`✅ Scholar found ${res.length} papers`);
        })
        .catch((e) => {
          debug("Scholar failed: %s", e.message);
          console.log(`❌ Scholar failed: ${e.message}`);
          bySource.scholar = [];
        })
    );
  }
  if (sources.includes("arxiv")) {
    tasks.push(
      withRetry(() => searchArxiv(topic, maxResults), {
        retries: 1,
        minDelayMs: 1000,
      })
        .then((res) => {
          bySource.arxiv = res;
          console.log(`✅ ArXiv found ${res.length} papers`);
        })
        .catch((e) => {
          debug("arXiv failed: %s", e.message);
          console.log(`❌ ArXiv failed: ${e.message}`);
          bySource.arxiv = [];
        })
    );
  }
  if (sources.includes("pubmed")) {
    tasks.push(
      withRetry(() => searchPubMed(topic, maxResults), {
        retries: 1,
        minDelayMs: 1000,
      })
        .then((res) => {
          bySource.pubmed = res;
          console.log(`✅ PubMed found ${res.length} papers`);
        })
        .catch((e) => {
          debug("PubMed failed: %s", e.message);
          console.log(`❌ PubMed failed: ${e.message}`);
          bySource.pubmed = [];
        })
    );
  }

  // Add OpenAlex support
  if (sources.includes("openalex")) {
    tasks.push(
      withRetry(() => openalex.searchWorks(topic, maxResults), {
        retries: 1,
        minDelayMs: 500,
      })
        .then((res) => {
          bySource.openalex = res;
          console.log(`✅ OpenAlex found ${res.length} papers`);
        })
        .catch((e) => {
          debug("OpenAlex failed: %s", e.message);
          console.log(`❌ OpenAlex failed: ${e.message}`);
          bySource.openalex = [];
        })
    );
  }

  // Add Unpaywall support
  if (sources.includes("unpaywall")) {
    tasks.push(
      withRetry(() => searchByTopic(topic, maxResults), {
        retries: 1,
        minDelayMs: 1000,
      })
        .then((res) => {
          bySource.unpaywall = res;
          console.log(`✅ Unpaywall found ${res.length} papers`);
        })
        .catch((e) => {
          debug("Unpaywall failed: %s", e.message);
          console.log(`❌ Unpaywall failed: ${e.message}`);
          bySource.unpaywall = [];
        })
    );
  }

  await Promise.all(tasks);

  // Merge with stronger dedup: prefer DOI; fallback to normalized title + year
  const normalizeTitle = (t) => (t || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Merge and track origins
  const mergedMap = new Map();
  for (const [sourceName, list] of Object.entries(bySource)) {
    for (const p of list) {
      if (!p || !p.title) continue;
      const doiKey = p.doi ? `doi:${String(p.doi).toLowerCase()}` : null;
      const titleKey = p.title ? `t:${normalizeTitle(p.title)}|y:${p.year || ""}` : null;
      const key = doiKey || titleKey;
      if (!key) continue;
      const existing = mergedMap.get(key);
      if (existing) {
        if (!existing.sources.includes(sourceName)) existing.sources.push(sourceName);
        // prefer to fill missing fields from this source
        ["authors","year","publication","pdfUrl","citationCount","url","doi"].forEach(f=>{
          if (!existing[f] && p[f]) existing[f] = p[f];
        });
      } else {
        mergedMap.set(key, { ...p, sources: [sourceName] });
      }
    }
  }
  let merged = Array.from(mergedMap.values());
  // Global cap for literature merged list
  if (Number.isFinite(maxResults) && maxResults > 0) {
    merged = merged.slice(0, maxResults);
  }

  return { bySource, merged };
};

module.exports = { searchMultipleSources };