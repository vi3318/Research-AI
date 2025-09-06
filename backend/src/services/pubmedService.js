const axios = require("axios");
const debug = require("debug")("researchai:pubmed");

/**
 * Search PubMed using E-utilities (esearch + esummary)
 * @param {string} topic
 * @param {number} maxResults
 * @returns {Promise<Array>} papers
 */
const searchPubMed = async (topic, maxResults = 10) => {
  try {
    const term = encodeURIComponent(topic);
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${term}&retmax=${maxResults}`;
    const { data: es } = await axios.get(esearchUrl, { timeout: 20000 });
    const ids = es?.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const idParam = ids.join(",");
    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${idParam}`;
    const { data: sum } = await axios.get(esummaryUrl, { timeout: 20000 });

    const result = [];
    const resultObj = sum?.result || {};
    for (const id of ids) {
      const item = resultObj[id];
      if (!item) continue;
      const title = (item.title || "").replace(/\s+/g, " ").trim();
      const authors = Array.isArray(item.authors)
        ? item.authors.map((a) => a.name).filter(Boolean).join(", ")
        : "Unknown Authors";
      const pubdate = item.pubdate || item.epubdate || "";
      const year = (pubdate.match(/\d{4}/) || [""])[0] || "Unknown Year";
      const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
      const publication = item.fulljournalname || item.source || "PubMed";
      const abstract = ""; // For now, skip abstract to avoid another round-trip
      const citation = `${authors}. (${year}). ${title}. ${publication}.`;

      result.push({
        title,
        authors,
        year,
        publication,
        abstract,
        url,
        pdfUrl: null,
        citationCount: null,
        citation,
        fullText: null,
        source: "pubmed",
      });
    }
    debug("PubMed returned %d items for topic '%s'", result.length, topic);
    return result;
  } catch (err) {
    debug("PubMed error: %O", err);
    throw new Error(`PubMed search failed: ${err.message}`);
  }
};

module.exports = { searchPubMed };