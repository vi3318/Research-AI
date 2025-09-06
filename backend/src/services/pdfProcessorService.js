const { chromium } = require("playwright");
const pdfParse = require("pdf-parse");
const fs = require("fs/promises");
const debug = require("debug")("researchai:pdf");
const { processFulltext } = require("./grobidService");
const { parseStringPromise } = require("xml2js");

debug("PDF processor service initialized");

function rewriteDriveUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      // patterns: /file/d/<id>/view or open?id=<id>
      const pathParts = u.pathname.split("/");
      const fileIdx = pathParts.indexOf("file");
      let id = u.searchParams.get("id");
      if (!id && fileIdx >= 0 && pathParts[fileIdx + 2]) {
        id = pathParts[fileIdx + 2];
      }
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${id}`;
      }
    }
  } catch (_) {}
  return url;
}

/**
 * Process a PDF buffer directly (faster than downloading)
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const processPDFBuffer = async (pdfBuffer, options = {}) => {
  try {
    debug("Processing PDF buffer (size: %d bytes)", pdfBuffer.length);
    
    const { maxPages = 10 } = options;
    
    // Use pdf-parse for fast text extraction
    const data = await pdfParse(pdfBuffer, {
      max: maxPages, // Limit pages for faster processing
      version: 'v2.0.550'
    });
    
    const result = {
      text: data.text || "",
      pages: data.numpages || 0,
      info: data.info || {},
      metadata: data.metadata || {},
      version: data.version || "unknown"
    };
    
    debug("PDF buffer processed successfully: %d pages, %d characters", 
          result.pages, result.text.length);
    
    return result;
  } catch (error) {
    debug("Error processing PDF buffer: %s", error.message);
    throw new Error(`Failed to process PDF buffer: ${error.message}`);
  }
};

/**
 * Process papers by downloading PDFs and extracting text using a robust method
 * @param {Object} papersByTopic - Object with topics as keys and arrays of paper metadata as values.
 * @returns {Promise<Object>} - Object with processed papers by topic.
 */
const processPapers = async (papersByTopic) => {
  debug(
    "Starting paper processing for %d topics",
    Object.keys(papersByTopic).length
  );
  const processedPapersByTopic = {};

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  });

  try {
    for (const [topic, papers] of Object.entries(papersByTopic)) {
      debug(`Processing topic: "${topic}" with ${papers.length} papers`);
      console.log(`Processing ${papers.length} papers for topic: ${topic}`);
      const processedPapers = [];

      for (const paper of papers) {
        if (!paper.title) {
          debug("Skipping paper with no title");
          continue;
        }

        const truncatedTitle =
          paper.title.length > 50
            ? paper.title.substring(0, 50) + "..."
            : paper.title;

        if (paper.pdfUrl) {
          debug(`Attempting to download PDF for paper: "${truncatedTitle}"`);
          const page = await context.newPage();

          try {
            let pdfBuffer = null;

            // Listen for the download event
            const downloadPromise = page
              .waitForEvent("download", { timeout: 30000 })
              .catch(() => null);

            // Try to rewrite Google Drive links to direct download
            const urlToFetch = rewriteDriveUrl(paper.pdfUrl);
            debug("Navigating to PDF URL: %s", urlToFetch);

            // Navigate to the URL
            const response = await page
              .goto(urlToFetch, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              })
              .catch(() => null);

            // Wait for whichever happens first: a download starts, or the page loads.
            const download = await downloadPromise;

            if (download) {
              // SCENARIO 1: A download was triggered
              const tempPath = await download.path();
              if (!tempPath) throw new Error("Download path not available.");
              pdfBuffer = await fs.readFile(tempPath);
              await fs.unlink(tempPath); // Clean up
            } else if (response && response.ok()) {
              // SCENARIO 2: Page loaded, likely an in-browser PDF viewer
              const contentType = response.headers()["content-type"];
              if (contentType && contentType.includes("application/pdf")) {
                pdfBuffer = await response.buffer();
              } else {
                debug("Page loaded but was not a PDF.");
              }
            } else {
              throw new Error(
                `Navigation failed or response was not OK. Status: ${
                  response ? response.status() : "N/A"
                }`
              );
            }

            if (pdfBuffer && pdfBuffer.length > 0) {
              debug(
                `PDF buffer obtained for paper: "${truncatedTitle}" (size: ${pdfBuffer.length} bytes)`
              );
              const pdfData = await pdfParse(pdfBuffer, { max: 2000000 });
              // Extract basic metadata if available
              const info = pdfData?.info || {};
              if (!paper.title && info?.Title) paper.title = String(info.Title);
              if (!paper.authors && (info?.Author || info?.Creator)) {
                paper.authors = String(info.Author || info.Creator);
              }
              paper.fullText = pdfData.text;
              debug(
                `Successfully extracted ${pdfData.text.length} characters.`
              );
              console.log(
                `Successfully extracted text from PDF: ${paper.title}`
              );

              // Optional: GROBID enrichment if configured
              try {
                if (process.env.GROBID_URL) {
                  const tei = await processFulltext(pdfBuffer);
                  const xml = await parseStringPromise(tei, { explicitArray: false, trim: true });
                  const teiHeader = xml?.TEI?.teiHeader || {};
                  const profileDesc = teiHeader?.profileDesc || {};
                  const abstractText = profileDesc?.abstract?.p;
                  if (!paper.abstract && abstractText) {
                    paper.abstract = typeof abstractText === "string" ? abstractText : JSON.stringify(abstractText);
                  }
                  // References
                  const listBibl = xml?.TEI?.text?.back?.listBibl || {};
                  const bibl = listBibl?.biblStruct || [];
                  const refs = Array.isArray(bibl) ? bibl : [bibl];
                  const references = [];
                  for (const r of refs) {
                    const title = r?.analytic?.title?._ || r?.monogr?.title?._ || r?.analytic?.title || r?.monogr?.title;
                    const doi = r?.idno?.["_"] || r?.monogr?.idno?.["_"] || r?.analytic?.idno?.["_"] || undefined;
                    const authors = r?.analytic?.author ? (Array.isArray(r.analytic.author) ? r.analytic.author : [r.analytic.author]) : [];
                    const authStr = authors.map(a => [a?.persName?.forename?._, a?.persName?.surname?._].filter(Boolean).join(" ")).filter(Boolean).join(", ");
                    const year = r?.monogr?.imprint?.date?.["@when"] || r?.monogr?.imprint?.date?.when || r?.monogr?.imprint?.date || undefined;
                    if (title) references.push({ title: typeof title === "string" ? title : JSON.stringify(title), doi, authors: authStr, year });
                  }
                  if (references.length) paper.references = references;
                }
              } catch (gerr) {
                debug("GROBID enrichment failed: %O", gerr);
              }
            } else {
              debug(
                `Failed to obtain a valid PDF buffer for "${truncatedTitle}"`
              );
            }
          } catch (downloadError) {
            debug(
              `Error downloading or processing PDF for "${truncatedTitle}": %O`,
              downloadError
            );
            console.error(
              `Error processing PDF for paper "${paper.title}":`,
              downloadError.message
            );
          } finally {
            if (!page.isClosed()) {
              await page.close();
            }
          }
        } else {
          debug(`No PDF URL available for paper: "${truncatedTitle}"`);
          console.log(`No PDF URL available for paper: ${paper.title}`);
        }
        processedPapers.push(paper);
      }
      processedPapersByTopic[topic] = processedPapers;
    }
  } finally {
    await browser.close();
  }

  debug("Paper processing complete for all topics");
  return processedPapersByTopic;
};

module.exports = {
  processPapers,
  processPDFBuffer,
};
