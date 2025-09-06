const axios = require("axios");
const { parseStringPromise } = require("xml2js");
const debug = require("debug")("researchai:arxiv");

/**
 * Search arXiv via public API
 * @param {string} topic
 * @param {number} maxResults
 * @returns {Promise<Array>} papers
 */
const searchArxiv = async (topic, maxResults = 10) => {
  const query = encodeURIComponent(topic);
  const url = `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=${maxResults}`;
  debug("Querying arXiv API: %s", url);
  try {
    const { data } = await axios.get(url, { timeout: 20000 });
    const xml = typeof data === "string" ? data : String(data);
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });

    const entries = parsed?.feed?.entry;
    if (!entries) {
      return [];
    }

    const items = Array.isArray(entries) ? entries : [entries];
    const papers = items.map((entry) => {
      const title = (entry.title || "").replace(/\s+/g, " ").trim();
      const authors = Array.isArray(entry.author)
        ? entry.author.map((a) => a.name).join(", ")
        : entry.author?.name || "Unknown Authors";
      const published = entry.published || entry.updated || "";
      const year = (published.match(/\d{4}/) || [""])[0] || "Unknown Year";

      let url = null;
      let pdfUrl = null;
      const links = Array.isArray(entry.link) ? entry.link : [entry.link].filter(Boolean);
      for (const l of links) {
        if (l?.$?.rel === "alternate") url = l.$.href;
        if (l?.$?.title === "pdf" || (l?.$.href || "").endsWith(".pdf")) pdfUrl = l.$.href;
      }

      const abstract = (entry.summary || "").replace(/\s+/g, " ").trim();
      const publication = entry?.["arxiv:journal_ref"] || "arXiv";

      const citation = `${authors}. (${year}). ${title}. ${publication}.`;

      return {
        title,
        authors,
        year,
        publication,
        abstract,
        url,
        pdfUrl,
        citationCount: null,
        citation,
        fullText: null,
        source: "arxiv",
      };
    });
    debug("arXiv returned %d items for topic '%s'", papers.length, topic);
    return papers;
  } catch (err) {
    debug("arXiv error: %O", err);
    throw new Error(`arXiv search failed: ${err.message}`);
  }
};

module.exports = { searchArxiv };