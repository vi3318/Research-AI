const axios = require("axios");
const debug = require("debug")("researchai:crossref");

const CROSSREF_BASE = "https://api.crossref.org";

async function searchWorkByTitle(title) {
  try {
    const params = new URLSearchParams();
    params.set("query.bibliographic", title);
    params.set("rows", "1");
    const mailto = process.env.CROSSREF_MAILTO ? `&mailto=${encodeURIComponent(process.env.CROSSREF_MAILTO)}` : "";
    const url = `${CROSSREF_BASE}/works?${params.toString()}${mailto}`;
    const { data } = await axios.get(url, { timeout: 15000 });
    const item = data?.message?.items?.[0];
    if (!item) return null;
    const doi = item.DOI;
    const citationCount = item["is-referenced-by-count"];
    const year = item?.issued?.["date-parts"]?.[0]?.[0];
    const authors = Array.isArray(item.author)
      ? item.author.map((a) => [a.given, a.family].filter(Boolean).join(" ")).join(", ")
      : undefined;
    return { doi, citationCount, year, authors };
  } catch (err) {
    debug("searchWorkByTitle error: %O", err);
    return null;
  }
}

async function fetchBibTeX(doi) {
  try {
    if (!doi) return null;
    const url = `${CROSSREF_BASE}/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return typeof data === "string" ? data : String(data);
  } catch (err) {
    debug("fetchBibTeX error: %O", err);
    return null;
  }
}

module.exports = { searchWorkByTitle, fetchBibTeX };

