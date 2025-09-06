const axios = require("axios");
const debug = require("debug")("researchai:unpaywall");

const contact = process.env.UNPAYWALL_EMAIL || "";

async function lookupByDOI(doi) {
  try {
    if (!doi || !contact) return null;
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(contact)}`;
    debug("unpaywall: GET %s", url);
    const { data } = await axios.get(url, { timeout: 10000 });
    const oa = data?.best_oa_location;
    const result = oa ? { oaUrl: oa?.url_for_pdf || oa?.url, hostType: oa?.host_type } : null;
    debug("unpaywall result: %o", result);
    return result;
  } catch (err) {
    debug("lookupByDOI error: %O", err);
    return null;
  }
}

// Enhanced Unpaywall search by topic using multiple approaches
async function searchByTopic(query, maxResults = 20) {
  try {
    if (!contact) {
      debug("unpaywall: No email configured, skipping topic search");
      return [];
    }

    debug("unpaywall: Searching for topic: %s", query);
    
    // Approach 1: Search through Crossref (which Unpaywall indexes)
    const crossrefResults = await searchCrossref(query, maxResults);
    
    // Approach 2: Search through DOAJ (Directory of Open Access Journals)
    const doajResults = await searchDOAJ(query, Math.floor(maxResults / 2));
    
    // Approach 3: Search through BASE (Bielefeld Academic Search Engine)
    const baseResults = await searchBASE(query, Math.floor(maxResults / 2));
    
    // Combine and deduplicate results
    const allResults = [...crossrefResults, ...doajResults, ...baseResults];
    const uniqueResults = deduplicateResults(allResults);
    
    debug("unpaywall: Found %d unique papers for topic: %s", uniqueResults.length, query);
    return uniqueResults.slice(0, maxResults);
    
  } catch (error) {
    debug("unpaywall: Topic search error: %O", error);
    return [];
  }
}

// Search Crossref for papers
async function searchCrossref(query, maxResults = 20) {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${maxResults}&select=DOI,title,author,abstract,published-print,type&filter=has-full-text:true`;
    debug("unpaywall: Searching Crossref: %s", url);
    
    const { data } = await axios.get(url, { timeout: 15000 });
    const items = data?.message?.items || [];
    
    return items.map(item => ({
      title: item.title?.[0] || "Unknown Title",
      authors: item.author?.map(a => `${a.given || ""} ${a.family || ""}`.trim()) || [],
      abstract: item.abstract || "",
      doi: item.DOI,
      year: item["published-print"]?.["date-parts"]?.[0]?.[0] || item["published-online"]?.["date-parts"]?.[0]?.[0],
      type: item.type,
      source: "crossref",
      url: `https://doi.org/${item.DOI}`,
      pdfUrl: null // Will be enriched with Unpaywall
    }));
    
  } catch (error) {
    debug("unpaywall: Crossref search error: %O", error);
    return [];
  }
}

// Search DOAJ (Directory of Open Access Journals)
async function searchDOAJ(query, maxResults = 10) {
  try {
    const url = `https://doaj.org/api/v2/search/articles?q=${encodeURIComponent(query)}&size=${maxResults}&sort=publishedDate:desc`;
    debug("unpaywall: Searching DOAJ: %s", url);
    
    const { data } = await axios.get(url, { timeout: 15000 });
    const results = data?.results || [];
    
    return results.map(item => ({
      title: item.biblioInfo?.title || "Unknown Title",
      authors: item.biblioInfo?.authors?.map(a => a.name) || [],
      abstract: item.biblioInfo?.abstract || "",
      doi: item.biblioInfo?.doi,
      year: item.biblioInfo?.publishedDate?.substring(0, 4),
      type: "journal-article",
      source: "doaj",
      url: item.links?.[0]?.url || `https://doi.org/${item.biblioInfo?.doi}`,
      pdfUrl: item.links?.find(l => l.type === "fulltext")?.url || null
    }));
    
  } catch (error) {
    debug("unpaywall: DOAJ search error: %O", error);
    return [];
  }
}

// Search BASE (Bielefeld Academic Search Engine)
async function searchBASE(query, maxResults = 10) {
  try {
    const url = `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?func=PerformSearch&query=${encodeURIComponent(query)}&hits=${maxResults}&format=json`;
    debug("unpaywall: Searching BASE: %s", url);
    
    const { data } = await axios.get(url, { timeout: 15000 });
    const results = data?.response?.docs || [];
    
    return results.map(item => ({
      title: item.title || "Unknown Title",
      authors: item.creator || [],
      abstract: item.abstract || "",
      doi: item.doi,
      year: item.year,
      type: item.type || "article",
      source: "base",
      url: item.url?.[0] || `https://doi.org/${item.doi}`,
      pdfUrl: item.url?.find(u => u.includes('.pdf')) || null
    }));
    
  } catch (error) {
    debug("unpaywall: BASE search error: %O", error);
    return [];
  }
}

// Deduplicate results based on DOI and title similarity
function deduplicateResults(results) {
  const seen = new Set();
  const unique = [];
  
  for (const result of results) {
    const key = result.doi || result.title?.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }
  
  return unique;
}

// Enhanced enrichment: Get full Unpaywall data for a paper
async function enrichPaper(paper) {
  try {
    if (!paper.doi || !contact) return paper;
    
    const unpaywallData = await lookupByDOI(paper.doi);
    if (unpaywallData) {
      paper.pdfUrl = unpaywallData.oaUrl || paper.pdfUrl;
      paper.unpaywallData = unpaywallData;
      paper.isOpenAccess = true;
      paper.oaHostType = unpaywallData.hostType;
    }
    
    return paper;
  } catch (error) {
    debug("unpaywall: Enrichment error for paper %s: %O", paper.doi, error);
    return paper;
  }
}

// Batch enrich multiple papers
async function enrichPapers(papers) {
  debug("unpaywall: Enriching %d papers with Unpaywall data", papers.length);
  
  const enriched = [];
  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    try {
      const enrichedPaper = await enrichPaper(paper);
      enriched.push(enrichedPaper);
      
      // Add small delay to be respectful to the API
      if (i < papers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      debug("unpaywall: Failed to enrich paper %d: %O", i, error);
      enriched.push(paper); // Add original paper if enrichment fails
    }
  }
  
  return enriched;
}

module.exports = { 
  lookupByDOI, 
  searchByTopic, 
  enrichPaper, 
  enrichPapers,
  searchCrossref,
  searchDOAJ,
  searchBASE
};

