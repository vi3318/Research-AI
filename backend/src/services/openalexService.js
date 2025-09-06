const axios = require("axios");
const debug = require("debug")("researchai:openalex");

const BASE = "https://api.openalex.org";

async function lookupByDOI(doi) {
  try {
    if (!doi) return null;
    const url = `${BASE}/works/doi:${encodeURIComponent(doi)}`;
    debug("openalex: GET %s", url);
    const { data } = await axios.get(url, { timeout: 15000 });
    return normalizeWork(data);
  } catch (err) {
    debug("lookupByDOI error: %O", err?.response?.data || err.message);
    return null;
  }
}

async function searchByTitle(title) {
  try {
    if (!title) return null;
    const url = `${BASE}/works?search=${encodeURIComponent(title)}&per_page=1`;
    debug("openalex: GET %s", url);
    const { data } = await axios.get(url, { timeout: 15000 });
    const work = Array.isArray(data?.results) ? data.results[0] : null;
    return normalizeWork(work);
  } catch (err) {
    debug("searchByTitle error: %O", err?.response?.data || err.message);
    return null;
  }
}

async function searchWorks(query, maxResults = 20) {
  try {
    if (!query) return [];
    const url = `${BASE}/works?search=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 200)}`;
    debug("openalex: GET %s", url);
    const { data } = await axios.get(url, { timeout: 15000 });
    const works = Array.isArray(data?.results) ? data.results : [];
    return works.map(normalizeWork).filter(Boolean);
  } catch (err) {
    debug("searchWorks error: %O", err?.response?.data || err.message);
    return [];
  }
}

function normalizeWork(work) {
  if (!work) return null;
  const title = work?.title;
  const doi = work?.doi?.replace(/^https?:\/\/doi.org\//i, "") || undefined;
  const citationCount = Number.isFinite(work?.cited_by_count) ? work.cited_by_count : undefined;
  const year = work?.publication_year || (work?.from_publication_date || '').slice(0,4) || undefined;
  const authors = Array.isArray(work?.authorships) ? work.authorships.map(a => a?.author?.display_name).filter(Boolean).join(", ") : undefined;
  const oaUrl = work?.primary_location?.pdf_url || work?.open_access?.oa_url || undefined;
  const hostVenue = work?.host_venue?.display_name || undefined;
  const abstract = work?.abstract_inverted_index ? 
    Object.entries(work.abstract_inverted_index)
      .flatMap(([word, positions]) => positions.map(pos => ({ word, pos })))
      .sort((a, b) => a.pos - b.pos)
      .map(item => item.word)
      .join(' ') : undefined;
  
  return { 
    title, 
    doi, 
    citationCount, 
    year, 
    authors, 
    oaUrl, 
    hostVenue, 
    abstract,
    url: work?.doi || work?.id,
    source: 'openalex'
  };
}

module.exports = { lookupByDOI, searchByTitle, searchWorks };

