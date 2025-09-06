const axios = require("axios");
const FormData = require("form-data");
const debug = require("debug")("researchai:grobid");

const baseUrl = (process.env.GROBID_URL || "").replace(/\/$/, "");

/**
 * Process a PDF buffer with GROBID /api/processFulltextDocument
 * Returns TEI XML as string
 */
async function processFulltext(pdfBuffer) {
  if (!baseUrl) throw new Error("GROBID_URL not configured");
  const form = new FormData();
  form.append("input", pdfBuffer, { filename: "paper.pdf", contentType: "application/pdf" });
  form.append("consolidateCitations", "1");
  const url = `${baseUrl}/api/processFulltextDocument`;
  debug("grobid: POST %s (bytes=%d)", url, pdfBuffer?.length || 0);
  const { data } = await axios.post(url, form, { headers: form.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity });
  debug("grobid: received TEI length=%d", typeof data === "string" ? data.length : JSON.stringify(data).length);
  return typeof data === "string" ? data : String(data);
}

module.exports = { processFulltext };

