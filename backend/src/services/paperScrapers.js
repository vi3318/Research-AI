const axios = require('axios');
const cheerio = require('cheerio');
const { parseString } = require('xml2js');
const { promisify } = require('util');

const parseXML = promisify(parseString);

/**
 * ArXiv Paper Scraper
 * Uses official ArXiv API: https://arxiv.org/help/api
 */
class ArxivScraper {
  constructor() {
    this.baseUrl = 'http://export.arxiv.org/api/query';
  }

  async search(query, maxResults = 10) {
    try {
      console.log(`[ArXiv] Searching for: "${query}"`);
      
      const response = await axios.get(this.baseUrl, {
        params: {
          search_query: `all:${query}`,
          start: 0,
          max_results: maxResults,
          sortBy: 'relevance',
          sortOrder: 'descending'
        },
        timeout: 15000
      });

      const parsed = await parseXML(response.data);
      const entries = parsed.feed.entry || [];

      const papers = entries.map(entry => {
        const authors = Array.isArray(entry.author) 
          ? entry.author.map(a => a.name[0]).join(', ')
          : entry.author?.name?.[0] || 'Unknown Author';

        const published = entry.published ? entry.published[0] : null;
        const year = published ? new Date(published).getFullYear() : null;

        // Extract ArXiv ID from the ID field
        const arxivId = entry.id[0].split('/abs/')[1] || entry.id[0];

        return {
          title: entry.title[0].replace(/\s+/g, ' ').trim(),
          authors,
          abstract: entry.summary[0].replace(/\s+/g, ' ').trim(),
          year,
          source: 'arxiv',
          source_id: arxivId,
          link: entry.id[0],
          pdf_url: entry.id[0].replace('/abs/', '/pdf/'),
          doi: entry.doi ? entry.doi[0] : null,
          venue: entry['arxiv:journal_ref'] ? entry['arxiv:journal_ref'][0] : 'arXiv preprint',
          citation_count: 0 // ArXiv API doesn't provide citation counts
        };
      });

      console.log(`[ArXiv] Found ${papers.length} papers`);
      return papers;

    } catch (error) {
      console.error('[ArXiv] Error:', error.message);
      return [];
    }
  }
}

/**
 * PubMed Paper Scraper
 * Uses NCBI E-utilities API: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 */
class PubMedScraper {
  constructor() {
    this.searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
    this.fetchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
  }

  async search(query, maxResults = 10) {
    try {
      console.log(`[PubMed] Searching for: "${query}"`);

      // Step 1: Search for paper IDs
      const searchResponse = await axios.get(this.searchUrl, {
        params: {
          db: 'pubmed',
          term: query,
          retmax: maxResults,
          retmode: 'json',
          sort: 'relevance'
        },
        timeout: 15000
      });

      const idList = searchResponse.data.esearchresult?.idlist || [];
      if (idList.length === 0) {
        console.log('[PubMed] No results found');
        return [];
      }

      // Step 2: Fetch full details for each ID
      const fetchResponse = await axios.get(this.fetchUrl, {
        params: {
          db: 'pubmed',
          id: idList.join(','),
          retmode: 'xml'
        },
        timeout: 15000
      });

      const parsed = await parseXML(fetchResponse.data);
      const articles = parsed.PubmedArticleSet?.PubmedArticle || [];

      const papers = articles.map(article => {
        const medline = article.MedlineCitation?.[0];
        const pubmed = article.PubmedData?.[0];
        
        if (!medline) return null;

        const articleData = medline.Article?.[0];
        const pmid = medline.PMID?.[0]._ || medline.PMID?.[0];
        
        const title = articleData?.ArticleTitle?.[0] || 'Untitled';
        const abstract = articleData?.Abstract?.[0]?.AbstractText?.[0]?._ || 
                        articleData?.Abstract?.[0]?.AbstractText?.[0] || '';
        
        const authorList = articleData?.AuthorList?.[0]?.Author || [];
        const authors = authorList
          .map(author => {
            const lastName = author.LastName?.[0] || '';
            const foreName = author.ForeName?.[0] || '';
            return `${foreName} ${lastName}`.trim();
          })
          .filter(Boolean)
          .join(', ') || 'Unknown Author';

        const pubDate = articleData?.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0];
        const year = pubDate?.Year?.[0] || null;

        const journal = articleData?.Journal?.[0]?.Title?.[0] || 'PubMed';

        // Try to get DOI
        const articleIds = pubmed?.ArticleIdList?.[0]?.ArticleId || [];
        const doiObj = articleIds.find(id => id.$.IdType === 'doi');
        const doi = doiObj?._ || null;

        return {
          title: title.replace(/<[^>]*>/g, '').trim(), // Remove HTML tags
          authors,
          abstract: abstract.replace(/<[^>]*>/g, '').trim(),
          year: year ? parseInt(year) : null,
          source: 'pubmed',
          source_id: pmid,
          link: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          pdf_url: doi ? `https://doi.org/${doi}` : null,
          doi,
          venue: journal,
          citation_count: 0 // PubMed doesn't provide citation counts directly
        };
      }).filter(Boolean);

      console.log(`[PubMed] Found ${papers.length} papers`);
      return papers;

    } catch (error) {
      console.error('[PubMed] Error:', error.message);
      return [];
    }
  }
}

/**
 * OpenAlex Paper Scraper
 * Uses OpenAlex API: https://docs.openalex.org/
 */
class OpenAlexScraper {
  constructor() {
    this.baseUrl = 'https://api.openalex.org/works';
  }

  async search(query, maxResults = 10) {
    try {
      console.log(`[OpenAlex] Searching for: "${query}"`);

      const response = await axios.get(this.baseUrl, {
        params: {
          search: query,
          per_page: maxResults,
          sort: 'cited_by_count:desc'
        },
        headers: {
          'User-Agent': 'ResearchAI (mailto:research@example.com)'
        },
        timeout: 15000
      });

      const results = response.data.results || [];

      const papers = results.map(work => {
        const authors = work.authorships?.map(a => a.author?.display_name).filter(Boolean).join(', ') || 'Unknown Author';
        const year = work.publication_year || null;
        const abstract = work.abstract_inverted_index ? this.reconstructAbstract(work.abstract_inverted_index) : '';

        return {
          title: work.title || 'Untitled',
          authors,
          abstract,
          year,
          source: 'openalex',
          source_id: work.id.replace('https://openalex.org/', ''),
          link: work.doi || work.id,
          pdf_url: work.open_access?.oa_url || null,
          doi: work.doi?.replace('https://doi.org/', ''),
          venue: work.host_venue?.display_name || work.primary_location?.source?.display_name || 'Unknown',
          citation_count: work.cited_by_count || 0
        };
      });

      console.log(`[OpenAlex] Found ${papers.length} papers`);
      return papers;

    } catch (error) {
      console.error('[OpenAlex] Error:', error.message);
      return [];
    }
  }

  reconstructAbstract(invertedIndex) {
    // OpenAlex stores abstracts as inverted indices
    // Reconstruct the original text
    const words = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      positions.forEach(pos => {
        words[pos] = word;
      });
    }
    return words.join(' ').substring(0, 500); // Limit length
  }
}

/**
 * Google Scholar Scraper (Limited - use cautiously)
 * Note: Google Scholar blocks automated scraping. Use sparingly and with delays.
 * Consider using SerpAPI or ScraperAPI for production.
 */
class GoogleScholarScraper {
  constructor() {
    this.baseUrl = 'https://scholar.google.com/scholar';
  }

  async search(query, maxResults = 10) {
    try {
      console.log(`[Google Scholar] Searching for: "${query}"`);
      console.warn('[Google Scholar] Warning: This may be rate-limited or blocked by Google');

      const response = await axios.get(this.baseUrl, {
        params: {
          q: query,
          hl: 'en',
          num: maxResults
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const papers = [];

      $('.gs_ri').each((i, elem) => {
        if (i >= maxResults) return false;

        const $elem = $(elem);
        const title = $elem.find('.gs_rt').text().replace(/\[.*?\]/g, '').trim();
        const snippet = $elem.find('.gs_rs').text().trim();
        const authors = $elem.find('.gs_a').text().split('-')[0].trim();
        const yearMatch = $elem.find('.gs_a').text().match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        
        const link = $elem.find('.gs_rt a').attr('href');
        const citedBy = $elem.find('.gs_fl a:contains("Cited by")').text();
        const citationCount = citedBy.match(/\d+/) ? parseInt(citedBy.match(/\d+/)[0]) : 0;

        if (title) {
          papers.push({
            title,
            authors: authors || 'Unknown Author',
            abstract: snippet,
            year,
            source: 'google_scholar',
            source_id: Buffer.from(title).toString('base64').substring(0, 50), // Create pseudo-ID
            link: link || '',
            pdf_url: null,
            doi: null,
            venue: 'Google Scholar',
            citation_count: citationCount
          });
        }
      });

      console.log(`[Google Scholar] Found ${papers.length} papers`);
      return papers;

    } catch (error) {
      console.error('[Google Scholar] Error:', error.message);
      if (error.response?.status === 429) {
        console.error('[Google Scholar] Rate limited - consider using delay or alternative API');
      }
      return [];
    }
  }
}

module.exports = {
  ArxivScraper,
  PubMedScraper,
  OpenAlexScraper,
  GoogleScholarScraper
};
